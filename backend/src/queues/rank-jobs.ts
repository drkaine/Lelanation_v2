import type { Job } from "bullmq";
import type { HydrationJobData, ParsedParticipantDto } from "../dto/match.dto.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { bullmqJobId } from "./bullmq-job-id.js";
import { rankQueue } from "./index.js";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const RANK_CHILD_JOB_OPTS = {
  attempts: 2,
  backoff: { type: "fixed" as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;

function rankChildJobId(puuid: string, region: string, today: string): string {
  return bullmqJobId("rank", region, puuid, today);
}

/** Rank jobs enfants d'un job hydration — dédupliqués par région canonique + puuid + jour. */
export async function enqueueRankChildJobsForHydration(
  hydrationJob: Job<HydrationJobData>,
  missingParticipants: ParsedParticipantDto[],
): Promise<number> {
  if (missingParticipants.length === 0) {
    return 0;
  }

  const today = todayIsoDate();
  const parent = {
    id: hydrationJob.id!,
    queue: hydrationJob.queueQualifiedName,
  };

  let enqueued = 0;
  for (const participant of missingParticipants) {
    const puuid = String(participant.puuid ?? "").trim();
    if (!puuid) continue;

    const region = normalizePlatformRegion(participant.region);
    const jobId = rankChildJobId(puuid, region, today);
    const existing = await rankQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state !== "failed") {
        continue;
      }
      await existing.remove().catch(() => undefined);
    }

    try {
      await rankQueue.add(
        "fetch-rank",
        { puuid, region, matchDate: today },
        {
          ...RANK_CHILD_JOB_OPTS,
          jobId,
          priority: 1,
          parent,
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
        continue;
      }
      throw error;
    }
  }

  return enqueued;
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
