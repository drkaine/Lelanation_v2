/**
 * Reconstruit IngestionJobData depuis matchs / teams / participants (schéma relationnel).
 */
import type { IngestionJobData } from "../dto/match.dto.js";
import { sql } from "../db/client.js";
import { normalizePlatformRegion } from "../riot/platform-region.js";
import { participantRowsToParsedDtos } from "./normalizedParticipantMapper.js";
import { buildTeamStatsFromNormalized } from "./buildTeamStatsFromNormalized.js";
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

export { buildTeamStatsFromNormalized } from "./buildTeamStatsFromNormalized.js";

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

  const teamStats = buildTeamStatsFromNormalized(
    {
      riot_match_id: match.riot_match_id,
      patch: match.patch,
      region,
      early_surrender: match.early_surrender === true,
      surrender: match.surrender === true,
    },
    teamRows,
    rankTier,
  );
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
