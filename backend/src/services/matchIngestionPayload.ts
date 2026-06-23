import type { RankSnapshot } from '../db/query.js';
import { getBestEffortRankSnapshotsForMatch, getRankSnapshotsAtOrAfterForMatch } from '../db/query.js';
import type { IngestionJobData, ParsedParticipantDto, TeamStatsDto } from '../dto/match.dto.js';
import { enqueueRankGateJobsForParticipants } from '../queues/rank-jobs.js';
import { resolveGameFirstObjective } from '../parsers/game-first-objective.js';
import { parseMatch } from '../parsers/match.parser.js';
import { sumObjectiveTimestampMsByTeamAndKey } from '../parsers/objective-timestamp-sums.js';
import { buildTeamObjectiveHistogramEntries } from '../parsers/team-objective-histogram.js';
import { normalizePlatformRegion } from '../riot/platform-region.js';
import type { MatchDto, MatchTimelineDto } from '../riot/types.js';
import type { LeagueEntryDto } from '../riot-gateway/routes/dto.js';
import {
  applyMatchRankFallbackToParticipants,
  averageMatchRankTierLabel,
  getMissingRankParticipants,
  matchReadyForAggregation,
  normalizeParticipantRankTier,
} from '../workers/match-rank-readiness.js';
import { rankSnapshotFromLeagueEntries } from './rankFromLeagueEntries.js';

export type TeamStatsBase = Omit<TeamStatsDto, 'rankTier'>;

function extractPatch(gameVersion: string): string {
  const [major, minor] = (gameVersion ?? '').split('.');
  if (!major || !minor) return 'unknown';
  return `${major}.${minor}`;
}

function resolveMatchGameDate(participants: ParsedParticipantDto[], match?: MatchDto): Date {
  if (match?.info?.gameStartTimestamp) {
    const gameDate = new Date(Number(match.info.gameStartTimestamp));
    gameDate.setUTCHours(0, 0, 0, 0);
    if (Number.isFinite(gameDate.getTime()) && gameDate.getTime() > 0) {
      return gameDate;
    }
  }
  const gameDate = new Date(participants[0]?.gameDate ?? '');
  gameDate.setUTCHours(0, 0, 0, 0);
  if (Number.isFinite(gameDate.getTime())) {
    return gameDate;
  }
  const fallback = new Date();
  fallback.setUTCHours(0, 0, 0, 0);
  return fallback;
}

function mergeRankEntriesIntoMatch(
  match: MatchDto,
  rankByPuuid: ReadonlyMap<string, LeagueEntryDto[]>,
): MatchDto {
  const enrichedParticipants = (match.info?.participants ?? []).map((participant) => {
    const puuid = String(participant.puuid ?? '').trim();
    if (!puuid || !rankByPuuid.has(puuid)) return participant;
    const snapshot = rankSnapshotFromLeagueEntries(rankByPuuid.get(puuid) ?? [], new Date());
    const tier = normalizeParticipantRankTier(snapshot.rankTier) ?? 'UNRANKED';
    return {
      ...participant,
      tier,
      rankTier: tier,
      rank: snapshot.rankDivision,
      rankDivision: snapshot.rankDivision,
      leaguePoints: snapshot.rankLp,
      rankLp: snapshot.rankLp,
    };
  });

  return {
    ...match,
    info: {
      ...match.info,
      participants: enrichedParticipants,
    },
  };
}

export function buildTeamStatsBase(
  match: MatchDto,
  participants: ParsedParticipantDto[],
  timeline: MatchTimelineDto,
  queueRegion: string,
): TeamStatsBase {
  const patch = extractPatch(String(match.info?.gameVersion ?? ''));
  const region = normalizePlatformRegion(String(match.info?.platformId ?? queueRegion ?? 'euw1'));
  const team100 = (match.info?.teams ?? []).find((team) => team.teamId === 100);
  const team200 = (match.info?.teams ?? []).find((team) => team.teamId === 200);
  const team100Win = team100?.win === true;
  const timestampSums = sumObjectiveTimestampMsByTeamAndKey(match, timeline);

  const objectives: TeamStatsDto['objectives'] = [];
  for (const team of [team100, team200]) {
    if (!team) continue;
    const tid = team.teamId as 100 | 200;
    const outcome = (team.teamId === 100 ? team100Win : !team100Win) ? 'win' : 'loss';
    for (const [type, value] of Object.entries(team.objectives ?? {})) {
      const kills = Number((value as { kills?: number }).kills ?? 0);
      if (kills > 0) {
        objectives.push({
          type,
          count: kills,
          team: tid,
          outcome,
          sumTimestampMs: timestampSums.get(`${tid}|${type}`) ?? 0,
        });
      }
      if ((value as { first?: boolean }).first === true) {
        const firstType = type === 'champion' ? 'firstBlood' : `${type}First`;
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
      type: 'gameFirst',
      count: gameFirst.bucket,
      team: gameFirst.team,
      outcome: gameFirst.outcome,
      sumTimestampMs: 0,
    });
  }

  const participantsInMatch = match.info?.participants ?? [];
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
    matchId: String(match.metadata?.matchId ?? ''),
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

function deriveMatchRankTier(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
): string {
  const average = averageMatchRankTierLabel(participants, closestSnapshots);
  if (!average) {
    throw new Error('deriveMatchRankTier_requires_at_least_one_ranked_participant');
  }
  return average;
}

function buildTeamStats(
  teamStatsBase: TeamStatsBase,
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
): TeamStatsDto {
  return {
    ...teamStatsBase,
    rankTier: deriveMatchRankTier(participants, closestSnapshots),
  };
}

function applySnapshotsToParticipants(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
  options?: { preserveRanked?: boolean },
): void {
  for (const participant of participants) {
    const puuid = String(participant.puuid ?? '').trim();
    const snapshot = closestSnapshots.get(puuid);
    const existingRank = normalizeParticipantRankTier(participant.rankTierValue ?? participant.rankTier);
    participant.needsRankFetch = !snapshot;
    if (!snapshot) continue;
    const normalizedTier = normalizeParticipantRankTier(snapshot.rankTier);
    if (normalizedTier) {
      participant.rankTier = normalizedTier;
      participant.rankTierValue = normalizedTier;
      participant.rankDivision = String(snapshot.rankDivision ?? '').trim().toUpperCase();
      participant.lp = snapshot.rankLp;
      continue;
    }
    if (options?.preserveRanked && existingRank) {
      continue;
    }
    participant.rankTier = 'UNRANKED';
    participant.rankTierValue = 'UNRANKED';
    participant.rankDivision = String(snapshot.rankDivision ?? 'UNRANKED').trim().toUpperCase();
    participant.lp = snapshot.rankLp;
  }
}

function resolveMatchRankTierForPayload(
  payload: IngestionJobData,
  closestSnapshots: Map<string, RankSnapshot>,
): string | null {
  return (
    normalizeParticipantRankTier(payload.teamStats.rankTier) ??
    normalizeParticipantRankTier(averageMatchRankTierLabel(payload.participants, closestSnapshots))
  );
}

export type RehydrateParticipantRanksOptions = {
  /**
   * Si true (défaut false), enfile des fetch-rank pour les joueurs sans snapshot
   * au lieu de matérialiser UNRANKED et bloquer l'agrégation sans retry.
   */
  enqueueMissingRankFetch?: boolean;
};

function finalizeParticipantRanksForAggregation(
  payload: IngestionJobData,
  closestSnapshots: Map<string, RankSnapshot>,
  gameDate: Date,
  options?: { materializeMissing?: boolean },
): void {
  const missing = getMissingRankParticipants(payload.participants, closestSnapshots);
  if (missing.length > 0 && options?.materializeMissing !== false) {
    materializeMissingRanksAsUnranked(payload.participants, closestSnapshots, gameDate);
    applySnapshotsToParticipants(payload.participants, closestSnapshots, { preserveRanked: true });
  }

  const matchRankTier = resolveMatchRankTierForPayload(payload, closestSnapshots);
  if (!matchRankTier) return;

  applyMatchRankFallbackToParticipants(payload.participants, matchRankTier);
  payload.teamStats.rankTier = matchRankTier;

  for (const participant of payload.participants) {
    const puuid = String(participant.puuid ?? '').trim();
    const tier = normalizeParticipantRankTier(participant.rankTierValue ?? participant.rankTier);
    if (!puuid || !tier) continue;
    closestSnapshots.set(puuid, {
      rankTier: tier,
      rankDivision: String(participant.rankDivision ?? '').trim(),
      rankLp: Number(participant.lp ?? 0),
      date: gameDate,
    });
  }
}

function materializeMissingRanksAsUnranked(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
  gameDate: Date,
): void {
  for (const participant of participants) {
    const puuid = String(participant.puuid ?? '').trim();
    if (!puuid || closestSnapshots.has(puuid)) continue;
    closestSnapshots.set(puuid, {
      rankTier: 'UNRANKED',
      rankDivision: 'UNRANKED',
      rankLp: 0,
      date: gameDate,
    });
    participant.needsRankFetch = false;
    participant.rankTier = 'UNRANKED';
    participant.rankTierValue = 'UNRANKED';
    participant.rankDivision = 'UNRANKED';
    participant.lp = 0;
  }
}

async function buildClosestSnapshots(
  participants: ParsedParticipantDto[],
  region: string,
  gameDate: Date,
  eventRankByPuuid: ReadonlyMap<string, LeagueEntryDto[]>,
): Promise<Map<string, RankSnapshot>> {
  const fromEvents = new Map<string, RankSnapshot>();
  for (const participant of participants) {
    const puuid = String(participant.puuid ?? '').trim();
    if (!puuid || !eventRankByPuuid.has(puuid)) continue;
    fromEvents.set(puuid, rankSnapshotFromLeagueEntries(eventRankByPuuid.get(puuid) ?? [], gameDate));
  }

  const puuids = participants.map((p) => p.puuid).filter(Boolean);
  const fromDb = await getRankSnapshotsAtOrAfterForMatch(puuids, region, gameDate);
  for (const [puuid, snapshot] of fromEvents) {
    fromDb.set(puuid, snapshot);
  }

  const missingPuuids = puuids.filter((puuid) => !fromDb.has(puuid));
  if (missingPuuids.length > 0) {
    const bestEffort = await getBestEffortRankSnapshotsForMatch(missingPuuids, gameDate);
    for (const [puuid, snapshot] of bestEffort) {
      fromDb.set(puuid, snapshot);
    }
  }
  return fromDb;
}

/** Enfile fetch-rank pour les participants sans snapshot `player_rank_history`. */
export async function enqueueRankFetchForMissingParticipants(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
  region: string,
): Promise<number> {
  const missing = getMissingRankParticipants(participants, closestSnapshots);
  if (missing.length === 0) return 0;

  for (const participant of missing) {
    participant.needsRankFetch = true;
  }

  const { enqueued } = await enqueueRankGateJobsForParticipants(missing, region);
  return enqueued;
}

/** Recharge les rangs participants depuis la DB avant agrégation (jobs déjà en file, clé perso). */
export async function rehydrateParticipantRanksForIngestion(
  payload: IngestionJobData,
  options?: RehydrateParticipantRanksOptions,
): Promise<{ missingRankFetchEnqueued: number }> {
  const participants = payload.participants;
  if (participants.length === 0) return { missingRankFetchEnqueued: 0 };

  const region = normalizePlatformRegion(participants[0].region);
  const gameDate = resolveMatchGameDate(participants);
  const closestSnapshots = await buildClosestSnapshots(participants, region, gameDate, new Map());
  applySnapshotsToParticipants(participants, closestSnapshots, { preserveRanked: true });

  if (options?.enqueueMissingRankFetch) {
    const enqueued = await enqueueRankFetchForMissingParticipants(participants, closestSnapshots, region);
    if (enqueued > 0) {
      return { missingRankFetchEnqueued: enqueued };
    }
  }

  finalizeParticipantRanksForAggregation(payload, closestSnapshots, gameDate, {
    materializeMissing: !options?.enqueueMissingRankFetch,
  });
  return { missingRankFetchEnqueued: 0 };
}

export async function buildIngestionPayloadFromMatchData(input: {
  match: MatchDto;
  timeline: MatchTimelineDto;
  queueRegion: string;
  rankByPuuid: ReadonlyMap<string, LeagueEntryDto[]>;
  resolveParticipantRanks: boolean;
}): Promise<IngestionJobData | null> {
  const enrichedMatch = mergeRankEntriesIntoMatch(input.match, input.rankByPuuid);
  const patch = extractPatch(String(enrichedMatch.info?.gameVersion ?? ''));
  const region = normalizePlatformRegion(String(enrichedMatch.info?.platformId ?? input.queueRegion));
  const participants = parseMatch(enrichedMatch, input.timeline, patch, region).filter(
    (participant): participant is ParsedParticipantDto => participant !== null,
  );
  if (participants.length === 0) return null;

  const teamStatsBase = buildTeamStatsBase(enrichedMatch, participants, input.timeline, region);
  const gameDate = resolveMatchGameDate(participants, enrichedMatch);

  // Toujours résoudre via DB (+ cache poller). resolveParticipantRanks=false désactive
  // seulement les fetch API live par participant, pas l'historique player_rank_history.
  const closestSnapshots = await buildClosestSnapshots(
    participants,
    region,
    gameDate,
    input.rankByPuuid,
  );

  applySnapshotsToParticipants(participants, closestSnapshots);

  if (!matchReadyForAggregation(participants, closestSnapshots)) {
    const missing = getMissingRankParticipants(participants, closestSnapshots);
    if (missing.length > 0) {
      await enqueueRankFetchForMissingParticipants(participants, closestSnapshots, region);
      return null;
    }
    return null;
  }

  const teamStats = buildTeamStats(teamStatsBase, participants, closestSnapshots);
  finalizeParticipantRanksForAggregation(
    { participants, teamStats },
    closestSnapshots,
    gameDate,
  );
  if (!matchReadyForAggregation(participants, closestSnapshots, teamStats.rankTier)) {
    return null;
  }

  return {
    participants,
    teamStats,
  };
}

export async function isMatchAlreadyIngested(matchId: string): Promise<boolean> {
  const { sql } = await import('../db/client.js');
  const rows = await sql<{ riot_match_id: string }[]>`
    SELECT riot_match_id
    FROM match_aggregated
    WHERE riot_match_id = ${matchId}
    LIMIT 1
  `;
  return rows.length > 0;
}
