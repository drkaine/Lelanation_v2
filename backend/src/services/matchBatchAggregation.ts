/**
 * Agrégation batch : matchs sans ligne dans `match_aggregated`.
 * `match_aggregated` est inséré uniquement après agrégation réussie.
 */
import { sql } from "../db/client.js";
import { appendUnifiedLog } from "../logging/unifiedAppLog.js";
import { loadIngestionPayloadFromNormalizedTables } from "./normalizedMatchLoader.js";
import { isMatchAlreadyAggregated } from "./normalizedMatchPersistence.js";
import {
  rehydrateParticipantRanksForIngestion,
  shouldEnqueueParticipantRankFetch,
} from "./matchIngestionPayload.js";
import {
  closestSnapshotsFromParticipants,
  matchReadyForAggregation,
} from "../workers/match-rank-readiness.js";
import { runAggregationTransaction } from "../workers/ingestion.worker.js";
import { recordAggregatedMatch } from "../redis/ingestion-metrics.js";

const DEFAULT_AGGREGATION_INTERVAL_MS = 30 * 60_000;
const DEFAULT_BATCH_LIMIT = 500;
const DEFAULT_PREPARE_CONCURRENCY = 4;

export type BatchAggregationResult = {
  candidates: number;
  aggregated: number;
  skippedNotReady: number;
  skippedAlreadyDone: number;
  failed: number;
  rankFetchEnqueued: number;
  durationMs: number;
};

export function getMatchAggregationIntervalMs(): number {
  const raw = process.env.MATCH_AGGREGATION_INTERVAL_MS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return DEFAULT_AGGREGATION_INTERVAL_MS;
}

export function getMatchAggregationBatchLimit(): number {
  const raw = process.env.MATCH_AGGREGATION_BATCH_LIMIT?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return DEFAULT_BATCH_LIMIT;
}

/**
 * Concurrence de la phase de PRÉPARATION (lectures seules) du batch d'agrégation.
 * Les écritures (`runAggregationTransaction`) restent sérialisées : plusieurs
 * transactions upsertant les mêmes lignes `champion_stats`/`champion_vs_stats`
 * dans des ordres différents provoqueraient des deadlocks. Seules les lectures —
 * chargement du payload normalisé + rehydratation des rangs, qui dominent le temps
 * mur par match — sont parallélisées.
 */
export function getMatchAggregationPrepareConcurrency(): number {
  const raw = process.env.MATCH_AGGREGATION_PREPARE_CONCURRENCY?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  }
  return DEFAULT_PREPARE_CONCURRENCY;
}

export async function listPendingAggregationMatchIds(limit: number): Promise<string[]> {
  const rows = await sql<{ riot_match_id: string }[]>`
    SELECT m.riot_match_id
    FROM matchs m
    WHERE NOT EXISTS (
      SELECT 1 FROM match_aggregated ma WHERE ma.riot_match_id = m.riot_match_id
    )
    ORDER BY m.created_at, m.riot_match_id
    LIMIT ${limit}
  `;
  return rows.map((row) => String(row.riot_match_id ?? "").trim()).filter(Boolean);
}

type PreparedMatch =
  | { matchId: string; outcome: "skipped_not_ready"; rankFetchEnqueued: number }
  | { matchId: string; outcome: "skipped_already_done"; rankFetchEnqueued: number }
  | {
      matchId: string;
      outcome: "ready";
      rankFetchEnqueued: number;
      payload: NonNullable<Awaited<ReturnType<typeof loadIngestionPayloadFromNormalizedTables>>>;
    };

/**
 * Phase de préparation READ-ONLY : détermine si un match est prêt à être agrégé et,
 * si oui, retourne le payload prêt à écrire. N'effectue aucune écriture dans les
 * tables d'agrégation (seuls des enqueues de rank fetch, idempotents, sont possibles).
 * Sûre à exécuter en parallèle.
 */
async function prepareMatchForAggregation(riotMatchId: string): Promise<PreparedMatch> {
  const matchId = String(riotMatchId ?? "").trim();
  if (!matchId) return { matchId, outcome: "skipped_not_ready", rankFetchEnqueued: 0 };

  if (await isMatchAlreadyAggregated(matchId)) {
    return { matchId, outcome: "skipped_already_done", rankFetchEnqueued: 0 };
  }

  const payload = await loadIngestionPayloadFromNormalizedTables(matchId, { skipRankGate: true });
  if (!payload) return { matchId, outcome: "skipped_not_ready", rankFetchEnqueued: 0 };

  const { missingRankFetchEnqueued } = await rehydrateParticipantRanksForIngestion(payload, {
    enqueueMissingRankFetch: shouldEnqueueParticipantRankFetch(),
  });
  const snapshots = closestSnapshotsFromParticipants(payload.participants);
  if (!matchReadyForAggregation(payload.participants, snapshots, payload.teamStats.rankTier)) {
    if (missingRankFetchEnqueued > 0) {
      appendUnifiedLog({
        section: "back",
        type: "info",
        script: "match_batch_aggregation",
        message: `rank_fetch_enqueued matchId=${matchId} jobs=${missingRankFetchEnqueued}`,
      });
    }
    return { matchId, outcome: "skipped_not_ready", rankFetchEnqueued: missingRankFetchEnqueued };
  }

  return { matchId, outcome: "ready", rankFetchEnqueued: 0, payload };
}

/** Phase d'écriture : une transaction d'agrégation par match. À exécuter en série. */
async function commitPreparedMatch(prepared: Extract<PreparedMatch, { outcome: "ready" }>): Promise<void> {
  await runAggregationTransaction(prepared.payload);
  await recordAggregatedMatch(prepared.matchId);
}

export async function aggregateSingleMatchFromNormalized(
  riotMatchId: string,
): Promise<{ outcome: "aggregated" | "skipped_not_ready" | "skipped_already_done"; rankFetchEnqueued: number }> {
  const prepared = await prepareMatchForAggregation(riotMatchId);
  if (prepared.outcome !== "ready") {
    return { outcome: prepared.outcome, rankFetchEnqueued: prepared.rankFetchEnqueued };
  }
  await commitPreparedMatch(prepared);
  return { outcome: "aggregated", rankFetchEnqueued: 0 };
}

/** Applique `fn` sur `items` avec une concurrence bornée, en préservant l'ordre des résultats. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runMatchBatchAggregationOnce(): Promise<BatchAggregationResult> {
  const startedAt = Date.now();
  const limit = getMatchAggregationBatchLimit();
  const matchIds = await listPendingAggregationMatchIds(limit);

  let aggregated = 0;
  let skippedNotReady = 0;
  let skippedAlreadyDone = 0;
  let failed = 0;
  let rankFetchEnqueued = 0;

  const prepareConcurrency = getMatchAggregationPrepareConcurrency();

  // Fenêtres : préparation (lectures) en parallèle, puis écritures en série.
  for (let offset = 0; offset < matchIds.length; offset += prepareConcurrency) {
    const window = matchIds.slice(offset, offset + prepareConcurrency);
    const prepared = await mapWithConcurrency(window, prepareConcurrency, async (matchId) => {
      try {
        return { ok: true as const, value: await prepareMatchForAggregation(matchId) };
      } catch (error) {
        return { ok: false as const, matchId, error };
      }
    });

    for (const item of prepared) {
      if (!item.ok) {
        failed += 1;
        const message = item.error instanceof Error ? item.error.message : String(item.error);
        appendUnifiedLog({
          section: "back",
          type: "warn",
          script: "match_batch_aggregation",
          message: `aggregate_failed matchId=${item.matchId} error=${message}`,
        });
        continue;
      }

      const p = item.value;
      rankFetchEnqueued += p.rankFetchEnqueued;
      if (p.outcome === "skipped_already_done") {
        skippedAlreadyDone += 1;
        continue;
      }
      if (p.outcome === "skipped_not_ready") {
        skippedNotReady += 1;
        continue;
      }

      try {
        await commitPreparedMatch(p);
        aggregated += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        appendUnifiedLog({
          section: "back",
          type: "warn",
          script: "match_batch_aggregation",
          message: `aggregate_failed matchId=${p.matchId} error=${message}`,
        });
      }
    }
  }

  const result: BatchAggregationResult = {
    candidates: matchIds.length,
    aggregated,
    skippedNotReady,
    skippedAlreadyDone,
    failed,
    rankFetchEnqueued,
    durationMs: Date.now() - startedAt,
  };

  if (matchIds.length > 0 || aggregated > 0) {
    appendUnifiedLog({
      section: "back",
      type: "info",
      script: "match_batch_aggregation",
      message: `batch_complete candidates=${result.candidates} aggregated=${result.aggregated} skipped_not_ready=${result.skippedNotReady} skipped_done=${result.skippedAlreadyDone} rank_fetch_enqueued=${result.rankFetchEnqueued} failed=${result.failed} duration_ms=${result.durationMs}`,
    });
    console.log(
      `[match-batch-aggregation] candidates=${result.candidates} aggregated=${result.aggregated} ` +
        `skipped_not_ready=${result.skippedNotReady} rank_fetch_enqueued=${result.rankFetchEnqueued} ` +
        `failed=${result.failed} duration_ms=${result.durationMs}`,
    );
  }

  return result;
}
