import { sql } from "../db/client.js";
import { RANK_GATE_GRACE_DAYS } from "../db/query.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { rankQueue } from "../queues/index.js";
import { rankChildJobId, RANK_CHILD_JOB_OPTS } from "../queues/rank-jobs-shared.js";
import { normalizePlatformRegion, platformRegionLookupKeys } from "../riot/platform-region.js";

const POLL_MS = 500;
const MAX_WAIT_MS = 45_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function rankInflightKey(puuid: string, region: string, date = todayIsoDate()): string {
  return `${normalizePlatformRegion(region)}:${puuid}:${date}`;
}

const inFlightRankFetches = new Map<string, Promise<void>>();

/**
 * Snapshot dispo si :
 *  - un row existe avec `date >= matchDateIso` (idéal), OU
 *  - un row existe dans la fenêtre `[matchDate - RANK_GATE_GRACE_DAYS, matchDate)` (best-effort).
 *
 * Aligné avec `getRankSnapshotsAtOrAfterForMatch` côté gate hydration.
 */
export async function hasRankSnapshotForMatchDate(
  puuid: string,
  region: string,
  matchDateIso: string,
  graceDays = RANK_GATE_GRACE_DAYS,
): Promise<boolean> {
  const regionKeys = platformRegionLookupKeys(region);
  const safeGraceDays = Math.max(0, Math.trunc(graceDays));
  const rows = await sql<{ exists: number }[]>`
    SELECT 1 AS exists
    FROM player_rank_history
    WHERE puuid = ${puuid}
      AND region = ANY(${sql.array(regionKeys, 25)})
      AND date >= ${matchDateIso}::date - (${safeGraceDays}::int || ' days')::interval
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function hasTodayRankSnapshot(puuid: string, region: string): Promise<boolean> {
  return hasRankSnapshotForMatchDate(puuid, region, todayIsoDate());
}

async function waitForBullMqRankJob(jobId: string, puuid: string, region: string, matchDateIso: string): Promise<void> {
  const job = await rankQueue.getJob(jobId);
  if (!job) return;

  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    if (await hasRankSnapshotForMatchDate(puuid, region, matchDateIso)) {
      return;
    }
    const state = await job.getState();
    if (state === "completed") {
      return;
    }
    if (state === "failed") {
      return;
    }
    await sleep(POLL_MS);
  }
}

export type EnsureRankOptions = {
  matchDateIso: string;
  parent?: { id: string; queue: string };
  priority?: number;
};

export type EnsureRankResult = {
  status: "ready" | "awaited" | "child_enqueued";
  dedupHit: boolean;
};

/**
 * Garantit qu'un snapshot rank existe pour matchDateIso.
 * Déduplique in-flight : plusieurs hydration jobs await la même Promise.
 */
export async function ensureRankSnapshot(
  puuid: string,
  region: string,
  options: EnsureRankOptions,
): Promise<EnsureRankResult> {
  const normalizedRegion = normalizePlatformRegion(region);
  const safePuuid = String(puuid ?? "").trim();
  if (!safePuuid || !normalizedRegion) {
    return { status: "ready", dedupHit: false };
  }

  const today = todayIsoDate();
  const inflightKey = rankInflightKey(safePuuid, normalizedRegion, today);

  if (await hasRankSnapshotForMatchDate(safePuuid, normalizedRegion, options.matchDateIso)) {
    return { status: "ready", dedupHit: false };
  }

  const existing = inFlightRankFetches.get(inflightKey);
  if (existing) {
    pollerV2Observability.recordRankDedupHit();
    await existing;
    return { status: "awaited", dedupHit: true };
  }

    let createdWithParent = false;
    const work = (async () => {
      if (await hasRankSnapshotForMatchDate(safePuuid, normalizedRegion, options.matchDateIso)) {
        return;
      }

      const jobId = rankChildJobId(safePuuid, normalizedRegion, today);
      let job = await rankQueue.getJob(jobId);

      if (!job) {
        try {
          await rankQueue.add(
            "fetch-rank",
            { puuid: safePuuid, region: normalizedRegion, matchDate: today },
            {
              ...RANK_CHILD_JOB_OPTS,
              jobId,
              priority: options.priority ?? 1,
              ...(options.parent ? { parent: options.parent } : {}),
            },
          );
          createdWithParent = Boolean(options.parent);
          job = await rankQueue.getJob(jobId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (
            !message.includes("Job already exists") &&
            !message.includes("cannot be replaced") &&
            !message.includes("-7")
          ) {
            throw error;
          }
          job = await rankQueue.getJob(jobId);
        }
      }

      if (job) {
        await waitForBullMqRankJob(jobId, safePuuid, normalizedRegion, options.matchDateIso);
      }
    })();

  inFlightRankFetches.set(inflightKey, work);
  try {
    await work;
  } finally {
    inFlightRankFetches.delete(inflightKey);
  }

  if (createdWithParent) {
    return { status: "child_enqueued", dedupHit: false };
  }
  return { status: "awaited", dedupHit: false };
}

export function clearRankInflightForTests(): void {
  inFlightRankFetches.clear();
}
