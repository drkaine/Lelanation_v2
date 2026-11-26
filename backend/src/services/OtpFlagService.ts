/**
 * Flag OTP : catégorie statistique, jamais exposée par joueur.
 * Un joueur est OTP si sa part de parties sur son champion le plus joué atteint le seuil
 * (réglages Gestion > OTP), avec un minimum de parties. Recalcul nocturne dans `otp_players`.
 */
import { sql } from '../db/client.js';
import type { OtpSettings } from './OtpSettingsService.js';

export interface PlayerChampionShare {
  games: number;
  topChampionGames: number;
}

export function isOtpPlayer(share: PlayerChampionShare, settings: OtpSettings): boolean {
  return share.games >= settings.minGames && share.topChampionGames >= (settings.thresholdPct / 100) * share.games;
}

/** Requête de recalcul : $1 = part (0-1, float8), $2 = minimum de parties. */
export function otpFlagsSql(settings: OtpSettings): { text: string; values: [number, number] } {
  const text = `
    WITH counts AS (
      SELECT puuid, champion_id, count(*)::int AS n
      FROM participants
      WHERE puuid IS NOT NULL
      GROUP BY puuid, champion_id
    ), per_player AS (
      SELECT puuid, sum(n)::int AS games, max(n)::int AS top_games
      FROM counts
      GROUP BY puuid
    )
    INSERT INTO otp_players (puuid, games, top_champion_games, computed_at)
    SELECT puuid, games, top_games, now()
    FROM per_player
    WHERE games >= $2 AND top_games >= $1::float8 * games`;
  return { text, values: [settings.thresholdPct / 100, settings.minGames] };
}

interface FlaggableParticipant {
  puuid: string;
  teamId: 100 | 200;
  otp?: boolean;
}

interface FlaggableTeamStats {
  otp?: boolean;
  otpTeam100?: boolean;
  otpTeam200?: boolean;
}

/** Participant : son flag. Équipe : au moins un OTP dans l'équipe. Match : au moins un OTP. */
export function applyOtpFlags(
  payload: { participants: FlaggableParticipant[]; teamStats: FlaggableTeamStats },
  otpPuuids: ReadonlySet<string>,
): void {
  for (const p of payload.participants) p.otp = otpPuuids.has(p.puuid);
  const team = (id: 100 | 200) => payload.participants.some((p) => p.teamId === id && p.otp === true);
  payload.teamStats.otpTeam100 = team(100);
  payload.teamStats.otpTeam200 = team(200);
  payload.teamStats.otp = payload.teamStats.otpTeam100 || payload.teamStats.otpTeam200;
}

/** Flags OTP des joueurs d'un match (lecture `otp_players`). */
export async function loadOtpPuuids(puuids: string[]): Promise<Set<string>> {
  if (puuids.length === 0) return new Set();
  const rows = await sql<{ puuid: string }[]>`SELECT puuid FROM otp_players WHERE puuid = ANY(${puuids})`;
  return new Set(rows.map((r) => r.puuid));
}

/** Recalcul nocturne : remplace tous les flags. Renvoie le nombre de joueurs OTP. */
export async function recomputeOtpFlags(settings: OtpSettings): Promise<number> {
  const { text, values } = otpFlagsSql(settings);
  return sql.begin(async (tx) => {
    await tx.unsafe('DELETE FROM otp_players');
    const res = await tx.unsafe(text, values);
    return res.count;
  });
}
