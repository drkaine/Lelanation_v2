import pLimit from "p-limit";
import { DelayedError, Worker } from "bullmq";
import { config } from "../config/index.js";
import { sql } from "../db/client.js";
import type { HydrationJobData, IngestionJobData, ParsedParticipantDto, TeamStatsDto } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { parseMatch } from "../parsers/match.parser.js";
import { HYDRATION_QUEUE } from "../queues/definitions.js";
import { ingestionQueue } from "../queues/index.js";
import { maxRankBacklogBeforePipelinePause, shouldPauseMatchPipelines } from "../queues/rank-backlog-policy.js";
import { enqueueRankFetchJobsForParticipants } from "../queues/rank-jobs.js";
import { rankQueue } from "../queues/index.js";
import { averageMatchRankTierLabel, matchReadyForAggregation, participantRankKnown } from "./match-rank-readiness.js";
import { redis } from "../redis/client.js";
import { waitForHydrationSlot } from "../redis/rate-scheduler.js";
import { NotFoundError, RiotClient } from "../riot/client.js";
import { sumObjectiveTimestampMsByTeamAndKey } from "../parsers/objective-timestamp-sums.js";
import { resolveGameFirstObjective } from "../parsers/game-first-objective.js";
import { buildTeamObjectiveHistogramEntries } from "../parsers/team-objective-histogram.js";
import type { MatchDto, MatchTimelineDto, ParticipantDto } from "../riot/types.js";
import {
  findPreviousPatchEntry,
  getPatchFromVersion,
  loadCurrentGameVersion,
  loadGameVersionsRecap,
  releaseDateToStartOfDayUtcSeconds,
} from "../services/RiotConfigService.js";

const riotClient = new RiotClient();
const hydrationLimit = pLimit(config.HYDRATION_CONCURRENCY);
const PATCH_SWITCH_GRACE_DAYS = 2;
/** Ré-hydratation après fetch rank (snapshot du jour requis). */
const HYDRATION_RANK_RETRY_DELAY_MS = 45_000;
const HYDRATION_RANK_RETRY_DELAY_SMALL_MS = 15_000;
const HYDRATION_RANK_RETRY_DELAY_BACKLOG_MS = 3 * 60_000;
const HYDRATION_RANK_RETRY_SMALL_UNRESOLVED_MAX = 2;

type HydrationJobOutcome =
  | { status: "completed" }
  | { status: "not_found" }
  | { status: "deferred_rank"; delayMs: number };

function extractPatch(gameVersion: string): string {
  const [major, minor] = (gameVersion ?? "").split(".");
  if (!major || !minor) return "unknown";
  return `${major}.${minor}`;
}

type PlayerRankRow = {
  puuid: string;
  rank_tier: string | null;
  rank_division: string | null;
  rank_lp: number | null;
};

function normalizeTier(value: string | null | undefined): string | null {
  const tier = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!tier || tier === "UNRANKED") return null;
  return tier;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Snapshot historique ≤ date du match (stats) ; League v4 du jour = needsRankFetch séparé. */
async function loadParticipantRankSnapshot(
  participants: ParticipantDto[],
  region: string,
  matchDate: Date,
): Promise<Map<string, PlayerRankRow>> {
  const puuids = Array.from(new Set(participants.map((participant) => participant.puuid).filter(Boolean)));
  if (puuids.length === 0) return new Map();
  const rows = await sql<PlayerRankRow[]>`
    SELECT DISTINCT ON (prh.puuid)
      prh.puuid,
      prh.rank_tier,
      prh.rank_division,
      prh.rank_lp
    FROM player_rank_history prh
    WHERE prh.puuid = ANY(${sql.array(puuids, 25)})
      AND prh.region = ${region}
      AND prh.date <= ${matchDate.toISOString().slice(0, 10)}::date
    ORDER BY prh.puuid, prh.date DESC
  `;
  return new Map(rows.map((row) => [row.puuid, row]));
}

async function loadTodayRankSnapshotPuuids(puuids: string[], region: string): Promise<Set<string>> {
  if (puuids.length === 0) return new Set();
  const rows = await sql<{ puuid: string }[]>`
    SELECT puuid
    FROM player_rank_history
    WHERE region = ${region}
      AND date = ${todayIsoDate()}::date
      AND puuid = ANY(${sql.array(puuids, 25)})
  `;
  return new Set(rows.map((row) => row.puuid));
}

function mergeRankSnapshotIntoMatch(match: MatchDto, rankByPuuid: Map<string, PlayerRankRow>): MatchDto {
  const enrichedParticipants = (match.info.participants ?? []).map((participant) => {
    const snapshot = rankByPuuid.get(participant.puuid);
    if (!snapshot) return participant;
    const tier = normalizeTier(snapshot.rank_tier);
    if (tier) {
      return {
        ...participant,
        tier,
        rankTier: tier,
        rank: snapshot.rank_division ?? "",
        rankDivision: snapshot.rank_division ?? "",
        leaguePoints: Number(snapshot.rank_lp ?? 0),
        rankLp: Number(snapshot.rank_lp ?? 0),
      };
    }
    if (String(snapshot.rank_tier ?? "").trim().toUpperCase() === "UNRANKED") {
      return {
        ...participant,
        tier: "UNRANKED",
        rankTier: "UNRANKED",
        rank: snapshot.rank_division ?? "UNRANKED",
        rankDivision: snapshot.rank_division ?? "UNRANKED",
        leaguePoints: Number(snapshot.rank_lp ?? 0),
        rankLp: Number(snapshot.rank_lp ?? 0),
      };
    }
    return participant;
  });
  return {
    ...match,
    info: {
      ...match.info,
      participants: enrichedParticipants,
    },
  };
}

function deriveMatchRankTier(participants: ParsedParticipantDto[]): string {
  const average = averageMatchRankTierLabel(participants);
  if (!average) {
    throw new Error("deriveMatchRankTier_requires_at_least_one_ranked_participant");
  }
  return average;
}

async function resolvePatchCutoffStartSec(nowSec: number): Promise<number> {
  const fallbackStart = nowSec - 14 * 86400;
  const currentRes = await loadCurrentGameVersion();
  if (currentRes.isErr()) return fallbackStart;
  const current = currentRes.unwrap();
  if (!current) return fallbackStart;

  const currentPatch = getPatchFromVersion(current.currentVersion);
  const currentReleaseStart = releaseDateToStartOfDayUtcSeconds(String(current.releaseDate ?? ""));
  if (!Number.isFinite(currentReleaseStart)) return fallbackStart;

  const currentCutoff = currentReleaseStart + PATCH_SWITCH_GRACE_DAYS * 86400;
  if (nowSec >= currentCutoff || !currentPatch) {
    return currentCutoff;
  }

  const recapRes = await loadGameVersionsRecap();
  if (recapRes.isErr()) return currentCutoff;
  const previous = findPreviousPatchEntry(recapRes.unwrap(), currentPatch);
  if (!previous) return currentCutoff;

  const previousReleaseStart = releaseDateToStartOfDayUtcSeconds(previous.releaseDate);
  if (!Number.isFinite(previousReleaseStart)) return currentCutoff;
  return previousReleaseStart + PATCH_SWITCH_GRACE_DAYS * 86400;
}

function resolveTeamStatsRegion(match: MatchDto, queueRegion: string): string {
  const q = String(queueRegion ?? "euw1")
    .trim()
    .toLowerCase();
  const pl = String(match.info.platformId ?? "")
    .trim()
    .toLowerCase();
  if (!pl || pl === "unknown" || pl === "global") return q || "euw1";
  return pl;
}

function parseTeamStats(
  match: MatchDto,
  participants: ParsedParticipantDto[],
  timeline: MatchTimelineDto,
  queueRegion: string,
): TeamStatsDto {
  const patch = extractPatch(match.info.gameVersion);
  const region = resolveTeamStatsRegion(match, queueRegion);
  const team100 = (match.info.teams ?? []).find((team) => team.teamId === 100);
  const team200 = (match.info.teams ?? []).find((team) => team.teamId === 200);
  const team100Win = team100?.win === true;
  const timestampSums = sumObjectiveTimestampMsByTeamAndKey(match, timeline);

  const objectives: TeamStatsDto["objectives"] = [];
  for (const team of [team100, team200]) {
    if (!team) continue;
    const tid = team.teamId as 100 | 200;
    const outcome = (team.teamId === 100 ? team100Win : !team100Win) ? "win" : "loss";
    for (const [type, value] of Object.entries(team.objectives ?? {})) {
      const kills = Number(value.kills ?? 0);
      if (kills > 0) {
        const sumKey = `${tid}|${type}`;
        objectives.push({
          type,
          count: kills,
          team: tid,
          outcome,
          sumTimestampMs: timestampSums.get(sumKey) ?? 0,
        });
      }
      if (value.first === true) {
        const firstType =
          type === "champion" ? "firstBlood" : `${type}First`;
        objectives.push({
          type: firstType,
          count: 1,
          team: tid,
          outcome,
          sumTimestampMs: 0,
        });
      }
    }
  }
  objectives.push(
    ...buildTeamObjectiveHistogramEntries(match, timeline, participants),
  );
  const gameFirst = resolveGameFirstObjective(match, timeline, participants);
  if (gameFirst) {
    objectives.push({
      type: "gameFirst",
      count: gameFirst.bucket,
      team: gameFirst.team,
      outcome: gameFirst.outcome,
      sumTimestampMs: 0,
    });
  }

  const participantsInMatch = match.info.participants ?? [];
  const surrendered = participantsInMatch.some((p) => p.gameEndedInSurrender === true);
  const earlySurrendered = participantsInMatch.some((p) => p.gameEndedInEarlySurrender === true);
  const earlySurrenderedTeam100 = participantsInMatch.some(
    (p) => p.teamId === 100 && p.teamEarlySurrendered === true
  );
  const earlySurrenderedTeam200 = participantsInMatch.some(
    (p) => p.teamId === 200 && p.teamEarlySurrendered === true
  );
  const surrenderedTeam100 = surrendered && !team100Win;
  const surrenderedTeam200 = surrendered && team100Win;

  return {
    matchId: match.metadata.matchId,
    patch,
    rankTier: deriveMatchRankTier(participants),
    region,
    team100Win,
    objectives,
    surrendered,
    earlySurrendered,
    surrenderedTeam100,
    surrenderedTeam200,
    earlySurrenderedTeam100,
    earlySurrenderedTeam200,
  };
}

async function runHydrationJob(data: HydrationJobData): Promise<HydrationJobOutcome> {
  const startedAt = Date.now();
  pollerV2Observability.recordHydrationStart();
  await waitForHydrationSlot();

  try {
    const [match, timeline] = await Promise.all([
      riotClient.getMatch(data.matchId, data.region),
      riotClient.getTimeline(data.matchId, data.region),
    ]);
    const nowSec = Math.floor(Date.now() / 1000);
    const cutoffStartSec = await resolvePatchCutoffStartSec(nowSec);
    const gameEndSec = Math.floor(
      (Number(match.info.gameEndTimestamp ?? 0) ||
        Number(match.info.gameStartTimestamp ?? 0) + Number(match.info.gameDuration ?? 0) * 1000) /
        1000,
    );
    if (Number.isFinite(gameEndSec) && gameEndSec > 0 && gameEndSec < cutoffStartSec) {
      console.info(
        `[hydration.worker] skipped_old_patch matchId=${data.matchId} game_end_sec=${gameEndSec} cutoff_sec=${cutoffStartSec}`,
      );
      pollerV2Observability.recordHydrationSkippedOldPatch();
      return { status: "completed" };
    }

    const region = String(match.info.platformId ?? data.region ?? "euw1").toLowerCase();
    const matchDate = new Date(
      Number(match.info.gameStartTimestamp ?? 0) ||
        Number(match.info.gameCreation ?? 0) ||
        Date.now(),
    );
    const safeMatchDate = Number.isFinite(matchDate.getTime()) ? matchDate : new Date();

    const rankByPuuid = await loadParticipantRankSnapshot(match.info.participants ?? [], region, safeMatchDate);
    const enrichedMatch = mergeRankSnapshotIntoMatch(match, rankByPuuid);

    const patch = extractPatch(enrichedMatch.info.gameVersion);
    const participants = parseMatch(enrichedMatch, timeline, patch)
      .filter((participant): participant is ParsedParticipantDto => participant !== null);

    const puuids = participants.map((p) => p.puuid).filter(Boolean);
    const withTodaySnapshot = await loadTodayRankSnapshotPuuids(puuids, region);
    for (const participant of participants) {
      participant.needsRankFetch = !withTodaySnapshot.has(participant.puuid);
    }

    const rankWaiting = await rankQueue.getWaitingCount();
    if (!shouldPauseMatchPipelines(rankWaiting)) {
      await enqueueRankFetchJobsForParticipants(participants, { priority: 1 });
    }

    if (!matchReadyForAggregation(participants, withTodaySnapshot)) {
      const unresolvedCount = participants.filter(
        (participant) => !participantRankKnown(participant, withTodaySnapshot),
      ).length;
      pollerV2Observability.recordHydrationRankGate(data.matchId, false);
      const rankRetryDelay =
        (await rankQueue.getWaitingCount()) > maxRankBacklogBeforePipelinePause()
          ? HYDRATION_RANK_RETRY_DELAY_BACKLOG_MS
          : unresolvedCount <= HYDRATION_RANK_RETRY_SMALL_UNRESOLVED_MAX
            ? HYDRATION_RANK_RETRY_DELAY_SMALL_MS
            : HYDRATION_RANK_RETRY_DELAY_MS;
      console.info(
        `[hydration.worker] deferred_ingestion_pending_rank matchId=${data.matchId} region=${region} unresolved=${participants.filter((p) => !participantRankKnown(p, withTodaySnapshot)).length} retry_ms=${rankRetryDelay}`,
      );
      pollerV2Observability.recordHydrationSuccess(1);
      return { status: "deferred_rank", delayMs: rankRetryDelay };
    }

    const teamStats = parseTeamStats(enrichedMatch, participants, timeline, region);
    const payload: IngestionJobData = { participants, teamStats };
    pollerV2Observability.recordHydrationRankGate(data.matchId, true);
    await ingestionQueue.add("ingest-match", payload);
    pollerV2Observability.recordHydrationSuccess(1);
    return { status: "completed" };
  } catch (error) {
    if (error instanceof NotFoundError) {
      pollerV2Observability.recordHydrationNotFound();
      console.warn(`[hydration.worker] match_not_found matchId=${data.matchId} region=${data.region}`);
      return { status: "not_found" };
    }
    pollerV2Observability.recordHydrationFailure(error);
    throw error;
  } finally {
    pollerV2Observability.recordDuration("hydrationJobMs", Date.now() - startedAt);
  }
}

export const hydrationWorker = new Worker<HydrationJobData>(
  HYDRATION_QUEUE,
  async (job) =>
    hydrationLimit(async () => {
      const rankWaiting = await rankQueue.getWaitingCount();
      if (shouldPauseMatchPipelines(rankWaiting)) {
        const delayMs = HYDRATION_RANK_RETRY_DELAY_BACKLOG_MS;
        pollerV2Observability.recordHydrationRankBacklogDefer();
        await job.moveToDelayed(Date.now() + delayMs, job.token);
        console.debug(
          JSON.stringify({
            msg: "hydration_deferred_rank_backlog",
            matchId: job.data.matchId,
            rankWaiting,
            threshold: maxRankBacklogBeforePipelinePause(),
          }),
        );
        throw new DelayedError(
          `hydration_deferred_rank_backlog delay_ms=${delayMs} matchId=${job.data.matchId}`,
        );
      }
      const outcome = await runHydrationJob(job.data);
      if (outcome.status === "deferred_rank") {
        await job.moveToDelayed(Date.now() + outcome.delayMs, job.token);
        throw new DelayedError(
          `hydration_deferred_pending_rank delay_ms=${outcome.delayMs} matchId=${job.data.matchId}`,
        );
      }
    }),
  {
    connection: redis,
    concurrency: config.HYDRATION_CONCURRENCY,
  },
);
