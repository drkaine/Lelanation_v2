import pLimit from "p-limit";
import { Worker } from "bullmq";
import { config } from "../config/index.js";
import type { HydrationJobData, IngestionJobData, ParsedParticipantDto, TeamStatsDto } from "../dto/match.dto.js";
import { parseMatch } from "../parsers/match.parser.js";
import { HYDRATION_QUEUE } from "../queues/definitions.js";
import { ingestionQueue } from "../queues/index.js";
import { redis } from "../redis/client.js";
import { waitForSlot } from "../redis/rate-limiter.js";
import { NotFoundError, RiotClient } from "../riot/client.js";
import type { MatchDto } from "../riot/types.js";

const riotClient = new RiotClient();
const hydrationLimit = pLimit(config.HYDRATION_CONCURRENCY);

function extractPatch(gameVersion: string): string {
  const [major, minor] = (gameVersion ?? "").split(".");
  if (!major || !minor) return "unknown";
  return `${major}.${minor}`;
}

function parseTeamStats(match: MatchDto): TeamStatsDto {
  const patch = extractPatch(match.info.gameVersion);
  const region = String(match.info.platformId ?? "unknown").toLowerCase();
  const team100 = (match.info.teams ?? []).find((team) => team.teamId === 100);
  const team200 = (match.info.teams ?? []).find((team) => team.teamId === 200);
  const team100Win = team100?.win === true;

  const objectives: TeamStatsDto["objectives"] = [];
  for (const team of [team100, team200]) {
    if (!team) continue;
    for (const [type, value] of Object.entries(team.objectives ?? {})) {
      objectives.push({
        type,
        count: Number(value.kills ?? 0),
        team: team.teamId as 100 | 200,
        outcome: (team.teamId === 100 ? team100Win : !team100Win) ? "win" : "loss",
      });
    }
  }

  const participants = match.info.participants ?? [];
  const surrendered = participants.some((p) => p.gameEndedInSurrender === true);
  const earlySurrendered = participants.some((p) => p.gameEndedInEarlySurrender === true);

  return {
    matchId: match.metadata.matchId,
    patch,
    rankTier: "UNKNOWN",
    region,
    team100Win,
    objectives,
    surrendered,
    earlySurrendered,
  };
}

async function runHydrationJob(data: HydrationJobData): Promise<void> {
  await waitForSlot(2);

  try {
    const [match, timeline] = await Promise.all([
      riotClient.getMatch(data.matchId, data.region),
      riotClient.getTimeline(data.matchId, data.region),
    ]);

    const patch = extractPatch(match.info.gameVersion);
    const participants = parseMatch(match, timeline, patch).filter(
      (participant): participant is ParsedParticipantDto => participant !== null,
    );
    const teamStats = parseTeamStats(match);

    const payload: IngestionJobData = { participants, teamStats };
    await ingestionQueue.add("ingest-match", payload);
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.warn(`[hydration.worker] match_not_found matchId=${data.matchId} region=${data.region}`);
      return;
    }
    throw error;
  }
}

export const hydrationWorker = new Worker<HydrationJobData>(
  HYDRATION_QUEUE,
  async (job) => hydrationLimit(() => runHydrationJob(job.data)),
  {
    connection: redis,
    concurrency: config.HYDRATION_CONCURRENCY,
  },
);
