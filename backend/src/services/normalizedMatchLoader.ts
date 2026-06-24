/**
 * Reconstruit IngestionJobData depuis matchs / teams / participants (schéma relationnel).
 */
import type { IngestionJobData, TeamStatsDto } from "../dto/match.dto.js";
import { sql } from "../db/client.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { participantRowsToParsedDtos } from "./normalizedParticipantMapper.js";
import {
  averageMatchRankTierLabel,
  closestSnapshotsFromParticipants,
  matchReadyForAggregation,
} from "../workers/match-rank-readiness.js";
import {
  rehydrateParticipantRanksForIngestion,
  shouldEnqueueParticipantRankFetch,
} from "./matchIngestionPayload.js";

type MatchRow = {
  riot_match_id: string;
  patch: string;
  region: string;
  game_date: string | Date;
  early_surrender: boolean;
  surrender: boolean;
  game_duration: number;
};

type TeamRow = Record<string, unknown>;

function gameDateIso(row: MatchRow): string {
  const raw = row.game_date;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw ?? "").slice(0, 10);
}

function buildTeamStatsFromNormalized(
  match: MatchRow,
  teams: TeamRow[],
  rankTier: string,
): TeamStatsDto {
  const team100 = teams.find((t) => Number(t.team_id) === 100);
  const team100Win = team100?.win === true;
  const objectives: TeamStatsDto["objectives"] = [];

  for (const team of teams) {
    const tid = Number(team.team_id) as 100 | 200;
    if (tid !== 100 && tid !== 200) continue;
    const outcome = (tid === 100 ? team100Win : !team100Win) ? "win" : "loss";
    const pushObjective = (type: string, count: number) => {
      if (count > 0) objectives.push({ type, count, team: tid, outcome, sumTimestampMs: 0 });
    };
    pushObjective("baron", Number(team.baron_kills ?? 0));
    pushObjective("dragon", Number(team.dragon_kills ?? 0));
    pushObjective("tower", Number(team.tower_kills ?? 0));
    pushObjective("horde", Number(team.horde_kills ?? 0));
    pushObjective("riftHerald", Number(team.rift_herald_kills ?? 0));
    pushObjective("inhibitor", Number(team.inhibitor_kills ?? 0));
    if (team.first_blood === true) {
      objectives.push({ type: "firstBlood", count: 1, team: tid, outcome, sumTimestampMs: 0 });
    }
  }

  const surrendered = match.surrender === true;
  const earlySurrendered = match.early_surrender === true;

  return {
    matchId: match.riot_match_id,
    patch: match.patch,
    region: normalizePlatformRegion(match.region),
    rankTier,
    team100Win,
    objectives,
    surrendered,
    earlySurrendered,
    surrenderedTeam100: surrendered && !team100Win,
    surrenderedTeam200: surrendered && team100Win,
    earlySurrenderedTeam100: earlySurrendered && !team100Win,
    earlySurrenderedTeam200: earlySurrendered && team100Win,
  };
}

export async function loadIngestionPayloadFromNormalizedTables(
  riotMatchId: string,
  options?: { skipRankGate?: boolean },
): Promise<IngestionJobData | null> {
  const matchRows = await sql<MatchRow[]>`
    SELECT riot_match_id, patch, region, game_date, early_surrender, surrender, game_duration
    FROM matchs
    WHERE riot_match_id = ${riotMatchId}
    LIMIT 1
  `;
  const match = matchRows[0];
  if (!match) return null;

  const participantRows = await sql<Record<string, unknown>[]>`
    SELECT * FROM participants WHERE riot_match_id = ${riotMatchId}
  `;
  if (participantRows.length === 0) return null;

  const teamRows = await sql<TeamRow[]>`
    SELECT * FROM teams WHERE riot_match_id = ${riotMatchId}
  `;

  const gameDate = gameDateIso(match);
  const region = normalizePlatformRegion(match.region);
  const participants = participantRowsToParsedDtos(participantRows, {
    riotMatchId: match.riot_match_id,
    patch: match.patch,
    region,
    gameDate,
    gameDurationSec: Math.max(0, Math.trunc(Number(match.game_duration) || 0)),
    earlySurrender: match.early_surrender === true,
    surrender: match.surrender === true,
  });
  if (participants.length === 0) return null;

  const closestSnapshots = closestSnapshotsFromParticipants(participants);
  let rankTier = averageMatchRankTierLabel(participants, closestSnapshots);
  if (!rankTier) {
    if (!options?.skipRankGate) return null;
    rankTier = "UNRANKED";
  }

  const teamStats = buildTeamStatsFromNormalized(match, teamRows, rankTier);
  const payload: IngestionJobData = { participants, teamStats };

  if (!options?.skipRankGate) {
    await rehydrateParticipantRanksForIngestion(payload, {
      enqueueMissingRankFetch: shouldEnqueueParticipantRankFetch(),
    });
    if (
      !matchReadyForAggregation(
        payload.participants,
        closestSnapshotsFromParticipants(payload.participants),
        teamStats.rankTier,
      )
    ) {
      return null;
    }
  }

  return payload;
}

export async function normalizedMatchExists(riotMatchId: string): Promise<boolean> {
  const rows = await sql<{ riot_match_id: string }[]>`
    SELECT riot_match_id FROM matchs WHERE riot_match_id = ${riotMatchId} LIMIT 1
  `;
  return rows.length > 0;
}
