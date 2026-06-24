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

export async function aggregateSingleMatchFromNormalized(
  riotMatchId: string,
): Promise<{ outcome: "aggregated" | "skipped_not_ready" | "skipped_already_done"; rankFetchEnqueued: number }> {
  const matchId = String(riotMatchId ?? "").trim();
  if (!matchId) return { outcome: "skipped_not_ready", rankFetchEnqueued: 0 };

  if (await isMatchAlreadyAggregated(matchId)) {
    return { outcome: "skipped_already_done", rankFetchEnqueued: 0 };
  }

  const payload = await loadIngestionPayloadFromNormalizedTables(matchId, { skipRankGate: true });
  if (!payload) return { outcome: "skipped_not_ready", rankFetchEnqueued: 0 };

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
    return { outcome: "skipped_not_ready", rankFetchEnqueued: missingRankFetchEnqueued };
  }

  await runAggregationTransaction(payload);
  await recordAggregatedMatch(matchId);
  return { outcome: "aggregated", rankFetchEnqueued: 0 };
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

  for (const matchId of matchIds) {
    try {
      const { outcome, rankFetchEnqueued: enqueued } = await aggregateSingleMatchFromNormalized(matchId);
      rankFetchEnqueued += enqueued;
      if (outcome === "aggregated") aggregated += 1;
      else if (outcome === "skipped_already_done") skippedAlreadyDone += 1;
      else skippedNotReady += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      appendUnifiedLog({
        section: "back",
        type: "warn",
        script: "match_batch_aggregation",
        message: `aggregate_failed matchId=${matchId} error=${message}`,
      });
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
