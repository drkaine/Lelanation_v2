/**
 * Onglet « Divers » (Équipe & objectifs) : taux d'AFK par rôle et rang, duos par paire de rôles et rang, chacun par côté (bleu/rouge).
 * Lu en direct sur les 15 jours de matchs gardés (participants, player_duo_games), cache 1 h par région.
 */
import { isDatabaseConfigured, queryRawUnsafe } from '../db/query.js';
import { RegionScopedMap, regionCacheKey, regionSqlConditions } from '../stats/statsRegion.js';
import { sqlLiteral } from '../stats/sqlLiteral.js';
import { toQueryStringArrayParam } from '../utils/statsFilters.js';

/** Côté de la carte : team_id 100 = bleu, 200 = rouge. */
export type TeamSide = 'BLUE' | 'RED';

export interface TeamMiscAfkRow {
  role: string;
  tier: string;
  side: TeamSide;
  games: number;
  afk: number;
}

export interface TeamMiscDuoRow {
  roleA: string;
  roleB: string;
  tier: string;
  side: TeamSide;
  games: number;
  wins: number;
}

export interface TeamMiscStats {
  afk: TeamMiscAfkRow[];
  duos: TeamMiscDuoRow[];
}

interface RawDuoRow {
  role_a: string | null;
  role_b: string | null;
  tier: string | null;
  team_id: number | null;
  games: bigint | number;
  wins: bigint | number;
}

interface RawAfkRow {
  role: string | null;
  tier: string | null;
  team_id: number | null;
  games: bigint | number;
  afk: bigint | number;
}

export function teamSide(teamId: number | null): TeamSide | null {
  if (teamId === 100) return 'BLUE';
  if (teamId === 200) return 'RED';
  return null;
}

const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'];
/** Calcul ~10 s sur 15 jours : cache 1 h, un seul calcul en vol par clé. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new RegionScopedMap<{ data: TeamMiscStats; expiresAt: number }>();
const inflight = new Map<string, Promise<TeamMiscStats>>();

/** Patchs demandés (16.1 couvre aussi 16.1.x) ; aucun = pas de filtre. */
export function teamMiscPatchSql(column: string, versions: readonly string[]): string | null {
  if (versions.length === 0) return null;
  const parts = versions.map((v) => {
    const p = sqlLiteral(v.trim());
    return `(${column} = '${p}' OR ${column} LIKE '${p}.%')`;
  });
  return parts.length === 1 ? parts[0]! : `(${parts.join(' OR ')})`;
}

function roleRank(role: string): number {
  const i = ROLE_ORDER.indexOf(role);
  return i === -1 ? ROLE_ORDER.length : i;
}

/** Paire de rôles rangée (TOP→UTILITY) pour qu'un duo ne compte qu'une fois par combinaison. */
export function mergeDuoRows(rows: readonly RawDuoRow[]): TeamMiscDuoRow[] {
  const merged = new Map<string, TeamMiscDuoRow>();
  for (const r of rows) {
    const side = teamSide(r.team_id);
    if (!r.role_a || !r.role_b || !r.tier || !side) continue;
    const [roleA, roleB] = roleRank(r.role_a) <= roleRank(r.role_b) ? [r.role_a, r.role_b] : [r.role_b, r.role_a];
    const key = `${roleA}|${roleB}|${r.tier}|${side}`;
    const row = merged.get(key) ?? { roleA, roleB, tier: r.tier, side, games: 0, wins: 0 };
    row.games += Number(r.games);
    row.wins += Number(r.wins);
    merged.set(key, row);
  }
  return [...merged.values()];
}

function where(conditions: Array<string | null>): string {
  const kept = conditions.filter((c): c is string => c != null);
  return kept.length > 0 ? kept.join(' AND ') : 'TRUE';
}

export async function getTeamMiscStats(version?: string | string[] | null): Promise<TeamMiscStats | null> {
  if (!isDatabaseConfigured()) return null;
  const versions = toQueryStringArrayParam(version);
  const cacheKey = versions.join(',');
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.data;
  const flightKey = regionCacheKey() + cacheKey;
  const running = inflight.get(flightKey);
  if (running) return running;
  const job = computeTeamMiscStats(versions).then((data) => {
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
  inflight.set(flightKey, job);
  try {
    return await job;
  } finally {
    inflight.delete(flightKey);
  }
}

async function computeTeamMiscStats(versions: readonly string[]): Promise<TeamMiscStats> {
  const afkWhere = where([
    "p.team_position IN ('TOP','JUNGLE','MIDDLE','BOTTOM','UTILITY')",
    teamMiscPatchSql('m.patch', versions),
    ...regionSqlConditions('m'),
  ]);
  const afkRows = await queryRawUnsafe<RawAfkRow[]>(`
    SELECT p.team_position AS role, r.rank_tier::text AS tier, p.team_id,
           COUNT(*)::bigint AS games, COUNT(*) FILTER (WHERE p.was_afk)::bigint AS afk
    FROM participants p
    JOIN matchs m ON m.riot_match_id = p.riot_match_id
    JOIN LATERAL (
      SELECT h.rank_tier FROM player_rank_history h
      WHERE h.puuid = p.puuid AND h.date <= m.game_date
      ORDER BY h.date DESC LIMIT 1
    ) r ON TRUE
    WHERE ${afkWhere}
    GROUP BY 1, 2, 3
  `);

  const duoWhere = where([teamMiscPatchSql('d.patch', versions), ...regionSqlConditions('d')]);
  const duoRows = await queryRawUnsafe<RawDuoRow[]>(`
    SELECT d.role_a, d.role_b, GREATEST(d.tier_a, d.tier_b)::text AS tier, pa.team_id,
           COUNT(*)::bigint AS games, COUNT(*) FILTER (WHERE d.win)::bigint AS wins
    FROM player_duo_games d
    LEFT JOIN participants pa ON pa.riot_match_id = d.riot_match_id AND pa.puuid = d.puuid_a
    WHERE ${duoWhere}
    GROUP BY 1, 2, 3, 4
  `);

  return {
    afk: afkRows.flatMap((r) => {
      const side = teamSide(r.team_id);
      return r.role && r.tier && side
        ? [{ role: r.role, tier: r.tier, side, games: Number(r.games), afk: Number(r.afk) }]
        : [];
    }),
    duos: mergeDuoRows(duoRows),
  };
}
