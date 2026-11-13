import { sql } from "../db/client.js";
import { recalculateEarlyPath } from "../parsers/junglePathExtract.js";
import {
  aggregateJunglePaths,
  type JunglePathGameRow,
  type JunglePathsAggregate,
} from "./junglePathAggregate.js";
import {
  buildChampionEventMap,
  eventMapGameLimit,
  type ChampionEventMap,
  type ChampionEventMapRow,
} from "./championEventMap.js";

/**
 * Premiers clears d'un champion jungle sur le patch, par côté (départs + top N).
 * Le path est recalculé depuis les camps bruts à chaque requête (algorithme courant, sans backfill).
 */
export async function queryJunglePaths(args: {
  championId: number;
  patch: string;
  queueId?: number | null;
  top?: number;
}): Promise<JunglePathsAggregate & { games: number }> {
  const top = Math.min(Math.max(args.top ?? 6, 1), 20);
  const queueId = args.queueId != null ? Math.trunc(args.queueId) : null;
  const rows = await sql<Array<{ team_id: number; win: boolean; doc: unknown }>>`
    SELECT p.team_id, p.win, p.jungle_camp_history AS doc
    FROM participants p
    INNER JOIN matchs m ON m.riot_match_id = p.riot_match_id
    WHERE p.champion_id = ${args.championId}
      AND m.patch = ${args.patch}
      AND p.team_position = 'JUNGLE'
      AND p.jungle_camp_history IS NOT NULL
      AND (${queueId}::int IS NULL OR m.queue_id = ${queueId})
  `;
  const games: JunglePathGameRow[] = rows.map((r) => {
    const early = recalculateEarlyPath(r.doc)?.early_path;
    return {
      teamId: Number(r.team_id),
      win: Boolean(r.win),
      path: early
        ? { pathSequence: early.path_sequence, pathHash: early.path_hash, clearTimeMs: early.clear_time_ms }
        : null,
    };
  });
  const agg = aggregateJunglePaths(games, { top });
  return { ...agg, games: agg.sides.reduce((n, s) => n + s.games, 0) };
}

/** Carte des événements d'un champion (kills classés, morts, wards) : toutes ses parties du patch, ou les `games` plus récentes. */
export async function queryChampionEventMap(args: {
  championId: number;
  patch: string;
  role?: string | null;
  queueId?: number | null;
  games?: number | null;
}): Promise<ChampionEventMap> {
  const games = eventMapGameLimit(args.games);
  const queueId = args.queueId != null ? Math.trunc(args.queueId) : null;
  const role = args.role ? args.role.toUpperCase() : null;
  const rows = await sql<ChampionEventMapRow[]>`
    SELECT p.team_position, p.kill_history, p.death_history, p.ward_history, p.ward_killed_history
    FROM participants p
    INNER JOIN matchs m ON m.riot_match_id = p.riot_match_id
    WHERE p.champion_id = ${args.championId}
      AND m.patch = ${args.patch}
      AND (${role}::text IS NULL OR p.team_position = ${role})
      AND (${queueId}::int IS NULL OR m.queue_id = ${queueId})
    ORDER BY m.created_at DESC
    LIMIT ${games ?? null}
  `;
  return buildChampionEventMap(rows);
}
