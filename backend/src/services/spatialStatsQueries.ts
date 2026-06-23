import { sql } from "../db/client.js";

export type JunglePathRow = {
  championId: number;
  patch: string;
  queueId: number;
  teamId: number;
  pathSequence: string[];
  pathHash: string;
  games: number;
  wins: number;
  winrate: number;
  avgClearTimeMs: number | null;
};

export async function queryJunglePaths(args: {
  championId: number;
  patch: string;
  queueId?: number | null;
  teamId?: number | null;
  limit?: number;
}): Promise<JunglePathRow[]> {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
  const queueId = args.queueId != null ? Math.trunc(args.queueId) : null;
  const teamId = args.teamId != null ? Math.trunc(args.teamId) : null;

  const rows = await sql<
    Array<{
      champion_id: number;
      patch: string;
      queue_id: number;
      team_id: number;
      path_sequence: string[];
      path_hash: string;
      games: number;
      wins: number;
      avg_clear_time_ms: string | number | null;
    }>
  >`
    SELECT
      p.champion_id,
      m.patch,
      m.queue_id,
      p.team_id,
      ARRAY(
        SELECT jsonb_array_elements_text(p.jungle_camp_history->'early_path'->'path_sequence')
      ) AS path_sequence,
      p.jungle_camp_history->'early_path'->>'path_hash' AS path_hash,
      COUNT(*)::int AS games,
      SUM(CASE WHEN p.win THEN 1 ELSE 0 END)::int AS wins,
      AVG((p.jungle_camp_history->'early_path'->>'clear_time_ms')::bigint)::bigint AS avg_clear_time_ms
    FROM participants p
    INNER JOIN matchs m ON m.riot_match_id = p.riot_match_id
    WHERE p.champion_id = ${args.championId}
      AND m.patch = ${args.patch}
      AND p.team_position = 'JUNGLE'
      AND p.jungle_camp_history->'early_path'->>'path_hash' IS NOT NULL
      AND (${queueId}::int IS NULL OR m.queue_id = ${queueId})
      AND (${teamId}::int IS NULL OR p.team_id = ${teamId})
    GROUP BY
      p.champion_id,
      m.patch,
      m.queue_id,
      p.team_id,
      p.jungle_camp_history->'early_path'->>'path_hash',
      p.jungle_camp_history->'early_path'->'path_sequence'
    ORDER BY games DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => {
    const games = Number(row.games ?? 0);
    const wins = Number(row.wins ?? 0);
    return {
      championId: Number(row.champion_id),
      patch: String(row.patch),
      queueId: Number(row.queue_id),
      teamId: Number(row.team_id),
      pathSequence: row.path_sequence ?? [],
      pathHash: String(row.path_hash),
      games,
      wins,
      winrate: games > 0 ? wins / games : 0,
      avgClearTimeMs:
        row.avg_clear_time_ms != null ? Math.trunc(Number(row.avg_clear_time_ms)) : null,
    };
  });
}
