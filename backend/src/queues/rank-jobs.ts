import type { Job } from "bullmq";
import type { HydrationJobData, ParsedParticipantDto } from "../dto/match.dto.js";
import { currentBudgetAllocationRef } from "../redis/budget-allocation-ref.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { ensureRankSnapshot } from "../services/rank-inflight.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { rankQueue } from "./index.js";
import {
  computeRankExistingJobsDelayMs,
  RANK_CHILD_JOB_OPTS,
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
  childJobsLinked: number;
  dedupHits: number;
  awaitedExisting: number;
};

/**
 * Déduplique les rank fetches in-flight et lie des enfants BullMQ quand possible.
 * Remplace l'ancien pattern delay 5s sur jobs rank orphelins.
 */
export async function ensureRankSnapshotsForHydration(
  hydrationJob: Job<HydrationJobData>,
  missingParticipants: ParsedParticipantDto[],
  matchDateIso: string,
): Promise<EnsureRankSnapshotsResult> {
  const parent = {
    id: hydrationJob.id!,
    queue: hydrationJob.queueQualifiedName,
  };

  let childJobsLinked = 0;
  let dedupHits = 0;
  let awaitedExisting = 0;
  let linkedParent = false;

  for (const participant of missingParticipants) {
    const puuid = String(participant.puuid ?? "").trim();
    if (!puuid) continue;

    const region = normalizePlatformRegion(participant.region);
    const result = await ensureRankSnapshot(puuid, region, {
      matchDateIso,
      parent: linkedParent ? undefined : parent,
      priority: 1,
    });

    if (result.dedupHit) {
      dedupHits += 1;
    }
    if (result.status === "child_enqueued") {
      childJobsLinked += 1;
      linkedParent = true;
    } else if (result.status === "awaited") {
      awaitedExisting += 1;
    }
  }

  if (dedupHits > 0 || awaitedExisting > 0) {
    console.log(
      JSON.stringify({
        msg: "rank_dedup_resolved",
        matchId: hydrationJob.data.matchId,
        dedupHits,
        awaitedExisting,
        childJobsLinked,
      }),
    );
  }

  return { childJobsLinked, dedupHits, awaitedExisting };
}

/** @deprecated Prefer ensureRankSnapshotsForHydration. */
export async function enqueueRankChildJobsForHydration(
  hydrationJob: Job<HydrationJobData>,
  missingParticipants: ParsedParticipantDto[],
): Promise<{ enqueued: number; alreadyPending: number; plan: RankChildEnqueuePlan }> {
  const matchDateIso = missingParticipants[0]?.gameDate?.slice(0, 10) ?? todayIsoDate();
  const result = await ensureRankSnapshotsForHydration(hydrationJob, missingParticipants, matchDateIso);
  return {
    enqueued: result.childJobsLinked,
    alreadyPending: result.awaitedExisting,
    plan: await planRankChildJobsForHydration(missingParticipants),
  };
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
