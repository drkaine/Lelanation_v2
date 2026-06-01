import { sql } from '../db/client.js';
import type { MatchDto } from '../riot-gateway/routes/dto.js';

function extractPatchFromMatch(match: MatchDto, fallbackPatch: string): string {
  const version = String(match.info?.gameVersion ?? '');
  const parts = version.split('.');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0]}.${parts[1]}`;
  }
  return fallbackPatch;
}

function gameDateFromMatch(match: MatchDto): string {
  const ts =
    Number(match.info?.gameStartTimestamp ?? 0) ||
    Number(match.info?.gameCreation ?? 0) ||
    Date.now();
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

type ParticipantColumnValues = {
  puuid: string | null;
  gameName: string | null;
  tagName: string | null;
};

function participantColumns(match: MatchDto): ParticipantColumnValues[] {
  const participants = match.info?.participants ?? [];
  const cols: ParticipantColumnValues[] = [];
  for (let i = 0; i < 10; i += 1) {
    const p = participants[i];
    if (!p) {
      cols.push({ puuid: null, gameName: null, tagName: null });
      continue;
    }
    cols.push({
      puuid: String(p.puuid ?? '').trim() || null,
      gameName:
        String(
          (p as { riotIdGameName?: string }).riotIdGameName ??
            (p as { summonerName?: string }).summonerName ??
            '',
        ).trim() || null,
      tagName:
        String((p as { riotIdTagline?: string }).riotIdTagline ?? (p as { tagLine?: string }).tagLine ?? '').trim() ||
        null,
    });
  }
  return cols;
}

export async function insertPendingProcessedMatch(args: {
  matchId: string;
  match: MatchDto;
  currentPatch: string;
  rank: string;
}): Promise<boolean> {
  const patch = extractPatchFromMatch(args.match, args.currentPatch);
  const gameDate = gameDateFromMatch(args.match);
  const cols = participantColumns(args.match);

  const rows = await sql<{ riot_match_id: string }[]>`
    INSERT INTO processed_matches (
      patch,
      game_date,
      riot_match_id,
      status,
      rank,
      participant1_puuid, participant1_game_name, participant1_tag_name,
      participant2_puuid, participant2_game_name, participant2_tag_name,
      participant3_puuid, participant3_game_name, participant3_tag_name,
      participant4_puuid, participant4_game_name, participant4_tag_name,
      participant5_puuid, participant5_game_name, participant5_tag_name,
      participant6_puuid, participant6_game_name, participant6_tag_name,
      participant7_puuid, participant7_game_name, participant7_tag_name,
      participant8_puuid, participant8_game_name, participant8_tag_name,
      participant9_puuid, participant9_game_name, participant9_tag_name,
      participant10_puuid, participant10_game_name, participant10_tag_name
    )
    VALUES (
      ${patch},
      ${gameDate}::date,
      ${args.matchId},
      'pending',
      ${args.rank},
      ${cols[0]?.puuid}, ${cols[0]?.gameName}, ${cols[0]?.tagName},
      ${cols[1]?.puuid}, ${cols[1]?.gameName}, ${cols[1]?.tagName},
      ${cols[2]?.puuid}, ${cols[2]?.gameName}, ${cols[2]?.tagName},
      ${cols[3]?.puuid}, ${cols[3]?.gameName}, ${cols[3]?.tagName},
      ${cols[4]?.puuid}, ${cols[4]?.gameName}, ${cols[4]?.tagName},
      ${cols[5]?.puuid}, ${cols[5]?.gameName}, ${cols[5]?.tagName},
      ${cols[6]?.puuid}, ${cols[6]?.gameName}, ${cols[6]?.tagName},
      ${cols[7]?.puuid}, ${cols[7]?.gameName}, ${cols[7]?.tagName},
      ${cols[8]?.puuid}, ${cols[8]?.gameName}, ${cols[8]?.tagName},
      ${cols[9]?.puuid}, ${cols[9]?.gameName}, ${cols[9]?.tagName}
    )
    ON CONFLICT (patch, riot_match_id) DO NOTHING
    RETURNING riot_match_id
  `;

  return rows.length > 0;
}

export async function updateProcessedMatchRank(patch: string, matchId: string, rank: string): Promise<void> {
  await sql`
    UPDATE processed_matches
    SET rank = ${rank}
    WHERE patch = ${patch}
      AND riot_match_id = ${matchId}
  `;
}

export async function markProcessedMatchError(patch: string, matchId: string): Promise<void> {
  await sql`
    UPDATE processed_matches
    SET status = 'error'
    WHERE patch = ${patch}
      AND riot_match_id = ${matchId}
  `;
}

export { extractPatchFromMatch, gameDateFromMatch };
