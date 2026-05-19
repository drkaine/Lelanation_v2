import type { ParsedParticipantDto } from "../dto/match.dto.js";
import { rankQueue } from "./index.js";

/** Enfile les fetch-rank dédupliqués par joueur et par jour (BullMQ ignore les jobId existants). */
export async function enqueueRankFetchJobsForParticipants(
  participants: ParsedParticipantDto[],
): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  const rankJobs = participants
    .filter((p) => p.needsRankFetch)
    .map((p) => ({
      name: "fetch-rank",
      data: { puuid: p.puuid, region: p.region, matchDate: p.gameDate },
      opts: {
        jobId: `rank:${p.puuid}:${today}`,
        attempts: 2,
        backoff: { type: "fixed" as const, delay: 30000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    }));

  if (rankJobs.length > 0) {
    await rankQueue.addBulk(rankJobs);
  }

  return rankJobs.length;
}
