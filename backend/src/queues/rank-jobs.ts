import type { Job } from "bullmq";
import pLimit from "p-limit";
import type { HydrationJobData, ParsedParticipantDto } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { currentBudgetAllocationRef } from "../redis/budget-allocation-ref.js";
import { ensureRankSnapshot, hasRankSnapshotForMatchDate } from "../services/rank-inflight.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { rankQueue } from "./index.js";
import {
  computeRankExistingJobsDelayMs,
  RANK_CHILD_JOB_OPTS,
  RANK_GATE_BATCH_POLL_MS,
  RANK_GATE_ENQUEUE_WAIT_MS,
  RANK_GATE_PRIORITY,
  RANK_PREFETCH_PRIORITY,
  rankChildJobId,
  todayIsoDate,
} from "./rank-jobs-shared.js";

export {
  computeRankExistingJobsDelayMs,
  rankChildJobId,
  RANK_PREFETCH_PRIORITY,
  RANK_GATE_PRIORITY,
  RANK_FILL_PRIORITY,
} from "./rank-jobs-shared.js";

export type RankChildEnqueuePlan = {
  toAdd: ParsedParticipantDto[];
  alreadyPending: ParsedParticipantDto[];
};

/** @deprecated Used by tests — prefer ensureRankSnapshotsForHydration. */
export async function planRankChildJobsForHydration(
  missingParticipants: ParsedParticipantDto[],
): Promise<RankChildEnqueuePlan> {
  const toAdd: ParsedParticipantDto[] = [];
  const alreadyPending: ParsedParticipantDto[] = [];
  const today = todayIsoDate();

  for (const participant of missingParticipants) {
    const puuid = String(participant.puuid ?? "").trim();
    if (!puuid) continue;

    const region = normalizePlatformRegion(participant.region);
    const jobId = rankChildJobId(puuid, region, today);
    const existing = await rankQueue.getJob(jobId);
    if (!existing) {
      toAdd.push(participant);
      continue;
    }

    const state = await existing.getState();
    if (state === "failed") {
      await existing.remove().catch(() => undefined);
      toAdd.push(participant);
      continue;
    }

    if (state === "completed") {
      continue;
    }

    alreadyPending.push(participant);
  }

  return { toAdd, alreadyPending };
}

export type EnsureRankSnapshotsResult = {
  /** @deprecated Always 0 — hydration no longer uses BullMQ parent-child links. */
  childJobsLinked: number;
  dedupHits: number;
  awaitedExisting: number;
  readyImmediate: number;
};

/** Enfile les rank jobs gate (sans bloquer le worker hydration). */
export async function enqueueRankGateJobsForParticipants(
  missingParticipants: ParsedParticipantDto[],
  matchRegion: string,
): Promise<{ enqueued: number; alreadyPending: number }> {
  const today = todayIsoDate();
  const normalizedMatchRegion = normalizePlatformRegion(matchRegion);
  let enqueued = 0;
  let alreadyPending = 0;

  for (const participant of missingParticipants) {
    const puuid = String(participant.puuid ?? "").trim();
    if (!puuid) continue;

    const jobId = rankChildJobId(puuid, normalizedMatchRegion, today);
    const existing = await rankQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== "failed") {
        alreadyPending += 1;
        continue;
      }
      await existing.remove().catch(() => undefined);
    }

    try {
      await rankQueue.add(
        "fetch-rank",
        { puuid, region: normalizedMatchRegion, matchDate: today },
        {
          ...RANK_CHILD_JOB_OPTS,
          jobId,
          priority: RANK_GATE_PRIORITY,
        },
      );
      enqueued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("Job already exists") ||
        message.includes("cannot be replaced") ||
        message.includes("-7")
      ) {
        alreadyPending += 1;
        continue;
      }
      throw error;
    }
  }

  return { enqueued, alreadyPending };
}

/**
 * @deprecated Préférer enqueueRankGateJobsForParticipants — ne bloque plus le worker.
 */
export async function ensureRankSnapshotsForHydration(
  hydrationJob: Job<HydrationJobData>,
  missingParticipants: ParsedParticipantDto[],
  matchDateIso: string,
  matchRegion: string,
): Promise<EnsureRankSnapshotsResult> {
  let dedupHits = 0;
  let awaitedExisting = 0;
  let readyImmediate = 0;
  const normalizedMatchRegion = normalizePlatformRegion(matchRegion);
  const gateLimit = pLimit(3);

  await Promise.all(
    missingParticipants.map((participant) =>
      gateLimit(async () => {
        const puuid = String(participant.puuid ?? "").trim();
        if (!puuid) return;

        const result = await ensureRankSnapshot(puuid, normalizedMatchRegion, {
          matchDateIso,
          priority: RANK_GATE_PRIORITY,
          maxWaitMs: RANK_GATE_ENQUEUE_WAIT_MS,
        });

        if (result.dedupHit) dedupHits += 1;
        if (result.status === "ready") readyImmediate += 1;
        if (result.status === "awaited" || result.status === "child_enqueued") {
          awaitedExisting += 1;
        }
      }),
    ),
  );

  const batchDeadline = Date.now() + RANK_GATE_BATCH_POLL_MS;
  while (Date.now() < batchDeadline) {
    let pending = 0;
    for (const participant of missingParticipants) {
      const puuid = String(participant.puuid ?? "").trim();
      if (!puuid) continue;
      if (!(await hasRankSnapshotForMatchDate(puuid, normalizedMatchRegion, matchDateIso))) {
        pending += 1;
      }
    }
    if (pending === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (dedupHits > 0 || awaitedExisting > 0) {
    console.log(
      JSON.stringify({
        msg: "rank_dedup_resolved",
        matchId: hydrationJob.data.matchId,
        dedupHits,
        awaitedExisting,
        readyImmediate,
        childJobsLinked: 0,
      }),
    );
  }

  return { childJobsLinked: 0, dedupHits, awaitedExisting, readyImmediate };
}

/** Enfile un rank prefetch depuis discovery (priorité haute, sans parent). */
export async function enqueueRankPrefetchJob(puuid: string, region: string): Promise<boolean> {
  const safePuuid = String(puuid ?? "").trim();
  const normalizedRegion = normalizePlatformRegion(region);
  if (!safePuuid || !normalizedRegion) return false;

  const today = todayIsoDate();
  const jobId = rankChildJobId(safePuuid, normalizedRegion, today);
  const existing = await rankQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "failed") {
      pollerV2Observability.recordRankPrefetchSkippedExisting();
      return false;
    }
    await existing.remove().catch(() => undefined);
  }

  try {
    await rankQueue.add(
      "fetch-rank",
      { puuid: safePuuid, region: normalizedRegion, matchDate: today },
      {
        ...RANK_CHILD_JOB_OPTS,
        jobId,
        priority: RANK_PREFETCH_PRIORITY,
      },
    );
    pollerV2Observability.recordRankPrefetchEnqueued();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("Job already exists") ||
      message.includes("cannot be replaced") ||
      message.includes("-7")
    ) {
      pollerV2Observability.recordRankPrefetchSkippedExisting();
      return false;
    }
    throw error;
  }
}

/** Enfile les fetch-rank dédupliqués (sans parent) — ex. post-ingestion. */
export async function enqueueRankFetchJobsForParticipants(
  participants: ParsedParticipantDto[],
  options?: { priority?: number },
): Promise<number> {
  const today = todayIsoDate();
  const priority = options?.priority ?? 10;

  const rankJobs = participants
    .filter((p) => p.needsRankFetch)
    .map((p) => {
      const region = normalizePlatformRegion(p.region);
      return {
        name: "fetch-rank",
        data: { puuid: p.puuid, region, matchDate: p.gameDate },
        opts: {
          jobId: rankChildJobId(p.puuid, region, today),
          priority,
          ...RANK_CHILD_JOB_OPTS,
          removeOnComplete: { count: 100 },
        },
      };
    });

  if (rankJobs.length > 0) {
    await rankQueue.addBulk(rankJobs);
  }

  return rankJobs.length;
}

export function computeRankExistingJobsDelayMsFromRef(pendingCount: number): number {
  return computeRankExistingJobsDelayMs(pendingCount, currentBudgetAllocationRef.rank);
}
