import { sql } from "../db/client.js";
import type { ParsedParticipantDto } from "../dto/match.dto.js";
import { bullmqJobId } from "./bullmq-job-id.js";
import { rankQueue } from "./index.js";

const RANK_PREFETCH_MS_PER_PLAYER = 800;
const RANK_PREFETCH_MAX_HYDRATION_DELAY_MS = 30_000;

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function computeRankPrefetchHydrationDelay(prefetchCount: number): number {
  if (prefetchCount <= 0) {
    return 0;
  }
  return Math.min(prefetchCount * RANK_PREFETCH_MS_PER_PLAYER, RANK_PREFETCH_MAX_HYDRATION_DELAY_MS);
}

/** Joueurs sans snapshot League du jour — prefetch avant hydration discovery. */
export async function prefetchRankJobsForDiscoveryPlayers(
  players: Array<{ puuid: string; region: string }>,
): Promise<number> {
  if (players.length === 0) {
    return 0;
  }

  const today = todayIsoDate();
  const puuids = players.map((player) => player.puuid);

  const needsRank = await sql<{ puuid: string; region: string }[]>`
    SELECT p.puuid, p.region
    FROM players p
    WHERE p.puuid = ANY(${sql.array(puuids, 25)})
      AND NOT EXISTS (
        SELECT 1
        FROM player_rank_history prh
        WHERE prh.puuid = p.puuid
          AND prh.region = p.region
          AND prh.date = ${today}::date
      )
  `;

  if (needsRank.length === 0) {
    return 0;
  }

  await rankQueue.addBulk(
    needsRank.map(({ puuid, region }) => ({
      name: "fetch-rank",
      data: { puuid, region, matchDate: today },
      opts: {
        jobId: bullmqJobId("rank", puuid, today),
        priority: 1,
        attempts: 2,
        backoff: { type: "fixed" as const, delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    })),
  );

  return needsRank.length;
}

/** Enfile les fetch-rank dédupliqués par joueur et par jour (BullMQ ignore les jobId existants). */
export async function enqueueRankFetchJobsForParticipants(
  participants: ParsedParticipantDto[],
  options?: { priority?: number },
): Promise<number> {
  const today = todayIsoDate();
  const priority = options?.priority ?? 10;

  const rankJobs = participants
    .filter((p) => p.needsRankFetch)
    .map((p) => ({
      name: "fetch-rank",
      data: { puuid: p.puuid, region: p.region, matchDate: p.gameDate },
      opts: {
        jobId: bullmqJobId("rank", p.puuid, today),
        priority,
        attempts: 2,
        backoff: { type: "fixed" as const, delay: 30_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    }));

  if (rankJobs.length > 0) {
    await rankQueue.addBulk(rankJobs);
  }

  return rankJobs.length;
}
