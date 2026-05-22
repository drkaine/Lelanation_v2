import pLimit from "p-limit";
import { DelayedError, WaitingChildrenError, Worker, type Job } from "bullmq";
import { config } from "../config/index.js";
import { getClosestRankSnapshotsAtOrAfter, type RankSnapshot } from "../db/query.js";
import { sql } from "../db/client.js";
import type { HydrationJobData, ParsedParticipantDto, TeamStatsDto } from "../dto/match.dto.js";
import { pollerV2Observability } from "../observability/poller-v2-observability.js";
import { parseMatch } from "../parsers/match.parser.js";
import { HYDRATION_QUEUE } from "../queues/definitions.js";
import { getRankBacklogCount, ingestionQueue } from "../queues/index.js";
import { maxRankBacklogBeforePipelinePause, shouldPauseMatchPipelines } from "../queues/rank-backlog-policy.js";
import { ensureRankSnapshotsForHydration } from "../queues/rank-jobs.js";
import {
  averageMatchRankTierLabel,
  getMissingRankParticipants,
  matchReadyForAggregation,
} from "./match-rank-readiness.js";
import { redis } from "../redis/client.js";
import {
  cachedRankValidForMatchDate,
  readRankCacheL1,
  readRankCacheRedis,
} from "../redis/rank-cache.js";
import { waitForHydrationSlot } from "../redis/rate-scheduler.js";
import { NotFoundError, RiotClient } from "../riot/client.js";
import { normalizePlatformRegion, platformRegionLookupKeys } from "../riot/platform-region.js";
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
const HYDRATION_RANK_RETRY_DELAY_BACKLOG_MS = 3 * 60_000;
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

type TeamStatsBase = Omit<TeamStatsDto, "rankTier">;

function normalizeTier(value: string | null | undefined): string | null {
  const tier = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!tier || tier === "UNRANKED") return null;
  return tier;
}

function resolveMatchGameDate(participants: ParsedParticipantDto[], match?: MatchDto): Date {
  if (match?.info?.gameStartTimestamp) {
    const gameDate = new Date(Number(match.info.gameStartTimestamp));
    gameDate.setUTCHours(0, 0, 0, 0);
    if (Number.isFinite(gameDate.getTime()) && gameDate.getTime() > 0) {
      return gameDate;
    }
  }
  const gameDate = new Date(participants[0]?.gameDate ?? "");
  gameDate.setUTCHours(0, 0, 0, 0);
  if (Number.isFinite(gameDate.getTime())) {
    return gameDate;
  }
  const fallback = new Date();
  fallback.setUTCHours(0, 0, 0, 0);
  return fallback;
}

async function loadParticipantRankSnapshot(
  participants: ParticipantDto[],
  region: string,
  matchDate: Date,
): Promise<Map<string, PlayerRankRow>> {
  const puuids = Array.from(new Set(participants.map((participant) => participant.puuid).filter(Boolean)));
  if (puuids.length === 0) return new Map();
  const regionKeys = platformRegionLookupKeys(region);
  const rows = await sql<PlayerRankRow[]>`
    SELECT DISTINCT ON (prh.puuid)
      prh.puuid,
      prh.rank_tier,
      prh.rank_division,
      prh.rank_lp
    FROM player_rank_history prh
    WHERE prh.puuid = ANY(${sql.array(puuids, 25)})
      AND prh.region = ANY(${sql.array(regionKeys, 25)})
      AND prh.date <= ${matchDate.toISOString().slice(0, 10)}::date
    ORDER BY prh.puuid, prh.date DESC
  `;
  return new Map(rows.map((row) => [row.puuid, row]));
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

function deriveMatchRankTier(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
): string {
  const average = averageMatchRankTierLabel(participants, closestSnapshots);
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
  return normalizePlatformRegion(String(match.info.platformId ?? queueRegion ?? "euw1"));
}

function parseTeamStatsBase(
  match: MatchDto,
  participants: ParsedParticipantDto[],
  timeline: MatchTimelineDto,
  queueRegion: string,
): TeamStatsBase {
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
        const firstType = type === "champion" ? "firstBlood" : `${type}First`;
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
  objectives.push(...buildTeamObjectiveHistogramEntries(match, timeline, participants));
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
    (p) => p.teamId === 100 && p.teamEarlySurrendered === true,
  );
  const earlySurrenderedTeam200 = participantsInMatch.some(
    (p) => p.teamId === 200 && p.teamEarlySurrendered === true,
  );
  const surrenderedTeam100 = surrendered && !team100Win;
  const surrenderedTeam200 = surrendered && team100Win;

  return {
    matchId: match.metadata.matchId,
    patch,
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

function parseTeamStats(
  teamStatsBase: TeamStatsBase,
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
): TeamStatsDto {
  return {
    ...teamStatsBase,
    rankTier: deriveMatchRankTier(participants, closestSnapshots),
  };
}

async function applyRankCacheToParticipants(
  participants: ParsedParticipantDto[],
  gameDate: Date,
): Promise<Map<string, RankSnapshot>> {
  const matchDateIso = gameDate.toISOString().slice(0, 10);
  const fromCache = new Map<string, RankSnapshot>();

  for (const participant of participants) {
    const puuid = String(participant.puuid ?? "").trim();
    if (!puuid) continue;
    const region = normalizePlatformRegion(participant.region);

    const l1 = readRankCacheL1(puuid, region, matchDateIso);
    if (l1 && cachedRankValidForMatchDate(l1, matchDateIso)) {
      pollerV2Observability.recordRankCacheL1Hit();
      pollerV2Observability.recordRankPrefetchHit();
      fromCache.set(puuid, {
        rankTier: l1.rankTier,
        rankDivision: l1.rankDivision,
        rankLp: l1.rankLp,
        date: new Date(l1.snapshotDate),
      });
      continue;
    }

    const cached = await readRankCacheRedis(puuid, region);
    if (cached && cachedRankValidForMatchDate(cached, matchDateIso)) {
      pollerV2Observability.recordRankCacheRedisHit();
      pollerV2Observability.recordRankPrefetchHit();
      fromCache.set(puuid, {
        rankTier: cached.rankTier,
        rankDivision: cached.rankDivision,
        rankLp: cached.rankLp,
        date: new Date(cached.snapshotDate),
      });
    }
  }

  return fromCache;
}

async function refreshParticipantsRankState(
  participants: ParsedParticipantDto[],
  gameDate: Date,
): Promise<Map<string, RankSnapshot>> {
  const puuids = participants.map((p) => p.puuid).filter(Boolean);
  const cachedSnapshots = await applyRankCacheToParticipants(participants, gameDate);
  const closestSnapshots = await getClosestRankSnapshotsAtOrAfter(puuids, gameDate);
  for (const [puuid, snapshot] of cachedSnapshots) {
    if (!closestSnapshots.has(puuid)) {
      closestSnapshots.set(puuid, snapshot);
    }
  }
  for (const participant of participants) {
    const snapshot = closestSnapshots.get(participant.puuid);
    participant.needsRankFetch = !snapshot;
    if (!snapshot) {
      continue;
    }
    const normalizedTier = normalizeTier(snapshot.rankTier);
    if (normalizedTier) {
      participant.rankTier = normalizedTier;
      participant.rankTierValue = normalizedTier;
      participant.rankDivision = String(snapshot.rankDivision ?? "").trim().toUpperCase();
      participant.lp = snapshot.rankLp;
      continue;
    }
    if (snapshot.rankTier === "UNRANKED") {
      participant.rankTier = "UNRANKED";
      participant.rankTierValue = "UNRANKED";
      participant.rankDivision = String(snapshot.rankDivision ?? "UNRANKED")
        .trim()
        .toUpperCase();
      participant.lp = snapshot.rankLp;
    }
  }
  return closestSnapshots;
}

async function finalizeHydrationRankGate(
  hydrationJob: Job<HydrationJobData>,
  _token: string,
  data: HydrationJobData,
  region: string,
  gameDate: Date,
  participants: ParsedParticipantDto[],
  teamStatsBase: TeamStatsBase,
): Promise<void> {
  let closestSnapshots = await refreshParticipantsRankState(participants, gameDate);
  const resolvedCount = participants.filter((p) => closestSnapshots.has(p.puuid)).length;
  const needFetch = participants.filter((p) => p.needsRankFetch).length;
  console.log(
    `[hydration] rank gate: ${resolvedCount}/${participants.length} resolved from history (match: ${gameDate.toISOString().slice(0, 10)}), ${needFetch} need fetch`,
  );

  if (matchReadyForAggregation(participants, closestSnapshots)) {
    const teamStats = parseTeamStats(teamStatsBase, participants, closestSnapshots);
    pollerV2Observability.recordHydrationRankGate(data.matchId, true);
    await ingestionQueue.add("ingest-match", { participants, teamStats });
    pollerV2Observability.recordHydrationSuccess(1);
    return;
  }

  pollerV2Observability.recordHydrationRankGate(data.matchId, false);
  let missing = getMissingRankParticipants(participants, closestSnapshots);

  if (missing.length === 0) {
    console.info(
      `[hydration.worker] skipped_no_ranked_participant matchId=${data.matchId} region=${region}`,
    );
    pollerV2Observability.recordHydrationSuccess(1);
    return;
  }

  const matchDateIso = gameDate.toISOString().slice(0, 10);
  await ensureRankSnapshotsForHydration(hydrationJob, missing, matchDateIso);

  closestSnapshots = await refreshParticipantsRankState(participants, gameDate);
  if (matchReadyForAggregation(participants, closestSnapshots)) {
    const teamStats = parseTeamStats(teamStatsBase, participants, closestSnapshots);
    pollerV2Observability.recordHydrationRankGate(data.matchId, true);
    await ingestionQueue.add("ingest-match", { participants, teamStats });
    pollerV2Observability.recordHydrationSuccess(1);
    return;
  }

  missing = getMissingRankParticipants(participants, closestSnapshots);
  if (missing.length > 0) {
    throw new Error(
      `rank_gate_still_blocked matchId=${data.matchId} missing=${missing.length} puuids=${missing.map((p) => p.puuid).slice(0, 3).join(",")}`,
    );
  }

  throw new Error(`rank_gate_still_blocked matchId=${data.matchId}`);
}

async function runHydrationJob(hydrationJob: Job<HydrationJobData>, token: string): Promise<void> {
  const startedAt = Date.now();
  const data = hydrationJob.data;
  pollerV2Observability.recordHydrationStart();
  let region = normalizePlatformRegion(data.region);
  let participants: ParsedParticipantDto[] = [];
  let teamStatsBase: TeamStatsBase | null = null;
  let gameDate = resolveMatchGameDate([]);

  try {
    const cachedHydration = hydrationJob.data.cachedHydration;
    if (cachedHydration?.participants && cachedHydration.teamStatsBase) {
      participants = cachedHydration.participants;
      teamStatsBase = cachedHydration.teamStatsBase;
      region = normalizePlatformRegion(cachedHydration.teamStatsBase.region ?? region);
      gameDate = resolveMatchGameDate(participants);
      pollerV2Observability.recordHydrationCacheHit();
    } else {
      pollerV2Observability.recordHydrationCacheMiss();
      await waitForHydrationSlot();

      const [match, timeline] = await Promise.all([
        riotClient.getMatch(data.matchId, data.region),
        riotClient.getMatchTimeline(data.matchId, data.region),
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
        return;
      }

      region = normalizePlatformRegion(String(match.info.platformId ?? data.region ?? "euw1"));
      gameDate = resolveMatchGameDate([], match);
      const matchDate = new Date(
        Number(match.info.gameStartTimestamp ?? 0) ||
          Number(match.info.gameCreation ?? 0) ||
          Date.now(),
      );
      const safeMatchDate = Number.isFinite(matchDate.getTime()) ? matchDate : new Date();

      const rankByPuuid = await loadParticipantRankSnapshot(match.info.participants ?? [], region, safeMatchDate);
      const enrichedMatch = mergeRankSnapshotIntoMatch(match, rankByPuuid);

      const patch = extractPatch(enrichedMatch.info.gameVersion);
      participants = parseMatch(enrichedMatch, timeline, patch, region).filter(
        (participant): participant is ParsedParticipantDto => participant !== null,
      );
      teamStatsBase = parseTeamStatsBase(enrichedMatch, participants, timeline, region);

      await hydrationJob.updateData({
        ...hydrationJob.data,
        cachedHydration: {
          participants,
          teamStatsBase,
        },
      });
    }

    if (!teamStatsBase) {
      throw new Error(`hydration_cache_state_invalid matchId=${data.matchId}`);
    }

    await finalizeHydrationRankGate(
      hydrationJob,
      token,
      data,
      region,
      gameDate,
      participants,
      teamStatsBase,
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      pollerV2Observability.recordHydrationNotFound();
      console.warn(`[hydration.worker] match_not_found matchId=${data.matchId} region=${data.region}`);
      return;
    }
    if (error instanceof WaitingChildrenError) {
      throw error;
    }
    pollerV2Observability.recordHydrationFailure(error);
    throw error;
  } finally {
    pollerV2Observability.recordDuration("hydrationJobMs", Date.now() - startedAt);
  }
}

export const hydrationWorker = new Worker<HydrationJobData>(
  HYDRATION_QUEUE,
  async (job, token) =>
    hydrationLimit(async () => {
      const rankBacklog = await getRankBacklogCount();
      if (shouldPauseMatchPipelines(rankBacklog)) {
        const delayMs = HYDRATION_RANK_RETRY_DELAY_BACKLOG_MS;
        pollerV2Observability.recordHydrationRankBacklogDefer();
        await job.moveToDelayed(Date.now() + delayMs, token);
        console.debug(
          JSON.stringify({
            msg: "hydration_deferred_rank_backlog",
            matchId: job.data.matchId,
            rankBacklog,
            threshold: maxRankBacklogBeforePipelinePause(),
          }),
        );
        throw new DelayedError(
          `hydration_deferred_rank_backlog delay_ms=${delayMs} matchId=${job.data.matchId}`,
        );
      }
      await runHydrationJob(job, token ?? "0");
    }),
  {
    connection: redis,
    concurrency: config.HYDRATION_CONCURRENCY,
  },
);
