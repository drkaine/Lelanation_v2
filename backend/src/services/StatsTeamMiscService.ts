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

/** Objectifs pris par l'équipe du duo (own) et par l'équipe adverse (enemy), sommés sur les parties. */
export interface DuoObjectiveCount {
  own: number;
  enemy: number;
}
export const DUO_OBJECTIVES = ['dragons', 'barons', 'towers', 'grubs', 'heralds'] as const;
export type DuoObjective = (typeof DUO_OBJECTIVES)[number];

export interface TeamMiscDuoRow {
  roleA: string;
  roleB: string;
  tier: string;
  side: TeamSide;
  games: number;
  wins: number;
  /** Parties abandonnées par l'équipe du duo. */
  surrenderFor: number;
  /** Parties abandonnées par l'équipe adverse. */
  surrenderAgainst: number;
  /** Parties où un des deux joueurs du duo est AFK. */
  afk: number;
  objectives: Record<DuoObjective, DuoObjectiveCount>;
}

/** Champion joué par `role` (un des deux rôles de la paire). */
export interface TeamMiscDuoPickRow {
  roleA: string;
  roleB: string;
  tier: string;
  role: string;
  championId: number;
  games: number;
  wins: number;
}

/** Champion banni par l'équipe du duo. */
export interface TeamMiscDuoBanRow {
  roleA: string;
  roleB: string;
  tier: string;
  championId: number;
  bans: number;
}

export interface TeamMiscStats {
  afk: TeamMiscAfkRow[];
  duos: TeamMiscDuoRow[];
  duoPicks: TeamMiscDuoPickRow[];
  duoBans: TeamMiscDuoBanRow[];
}

type Count = bigint | number;

interface RawDuoRow {
  role_a: string | null;
  role_b: string | null;
  tier: string | null;
  team_id: number | null;
  games: Count;
  wins: Count;
  surr_for: Count;
  surr_against: Count;
  afk: Count;
  own_dragons: Count;
  enemy_dragons: Count;
  own_barons: Count;
  enemy_barons: Count;
  own_towers: Count;
  enemy_towers: Count;
  own_grubs: Count;
  enemy_grubs: Count;
  own_heralds: Count;
  enemy_heralds: Count;
}

interface RawDuoPickRow {
  role_self: string | null;
  role_other: string | null;
  tier: string | null;
  champion: number | null;
  games: Count;
  wins: Count;
}

interface RawDuoBanRow {
  role_a: string | null;
  role_b: string | null;
  tier: string | null;
  champion: number | null;
  bans: Count;
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
/** Champions gardés par paire de rôles, rôle et rang (picks) ou paire et rang (bans). */
const TOP_PER_GROUP = 10;
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
function orderedPair(a: string, b: string): [string, string] {
  return roleRank(a) <= roleRank(b) ? [a, b] : [b, a];
}

function emptyObjectives(): Record<DuoObjective, DuoObjectiveCount> {
  return {
    dragons: { own: 0, enemy: 0 },
    barons: { own: 0, enemy: 0 },
    towers: { own: 0, enemy: 0 },
    grubs: { own: 0, enemy: 0 },
    heralds: { own: 0, enemy: 0 },
  };
}

function rawObjective(r: RawDuoRow, o: DuoObjective): DuoObjectiveCount {
  const pairs: Record<DuoObjective, [Count, Count]> = {
    dragons: [r.own_dragons, r.enemy_dragons],
    barons: [r.own_barons, r.enemy_barons],
    towers: [r.own_towers, r.enemy_towers],
    grubs: [r.own_grubs, r.enemy_grubs],
    heralds: [r.own_heralds, r.enemy_heralds],
  };
  const [own, enemy] = pairs[o];
  return { own: Number(own), enemy: Number(enemy) };
}

export function mergeDuoRows(rows: readonly RawDuoRow[]): TeamMiscDuoRow[] {
  const merged = new Map<string, TeamMiscDuoRow>();
  for (const r of rows) {
    const side = teamSide(r.team_id);
    if (!r.role_a || !r.role_b || !r.tier || !side) continue;
    const [roleA, roleB] = orderedPair(r.role_a, r.role_b);
    const key = `${roleA}|${roleB}|${r.tier}|${side}`;
    const row = merged.get(key) ?? {
      roleA,
      roleB,
      tier: r.tier,
      side,
      games: 0,
      wins: 0,
      surrenderFor: 0,
      surrenderAgainst: 0,
      afk: 0,
      objectives: emptyObjectives(),
    };
    row.games += Number(r.games);
    row.wins += Number(r.wins);
    row.surrenderFor += Number(r.surr_for);
    row.surrenderAgainst += Number(r.surr_against);
    row.afk += Number(r.afk);
    for (const o of DUO_OBJECTIVES) {
      const add = rawObjective(r, o);
      row.objectives[o].own += add.own;
      row.objectives[o].enemy += add.enemy;
    }
    merged.set(key, row);
  }
  return [...merged.values()];
}

export function mergeDuoPicks(rows: readonly RawDuoPickRow[]): TeamMiscDuoPickRow[] {
  const merged = new Map<string, TeamMiscDuoPickRow>();
  for (const r of rows) {
    if (!r.role_self || !r.role_other || !r.tier || r.champion == null) continue;
    const [roleA, roleB] = orderedPair(r.role_self, r.role_other);
    const key = `${roleA}|${roleB}|${r.tier}|${r.role_self}|${r.champion}`;
    const row = merged.get(key) ?? {
      roleA,
      roleB,
      tier: r.tier,
      role: r.role_self,
      championId: r.champion,
      games: 0,
      wins: 0,
    };
    row.games += Number(r.games);
    row.wins += Number(r.wins);
    merged.set(key, row);
  }
  return [...merged.values()];
}

export function mergeDuoBans(rows: readonly RawDuoBanRow[]): TeamMiscDuoBanRow[] {
  const merged = new Map<string, TeamMiscDuoBanRow>();
  for (const r of rows) {
    if (!r.role_a || !r.role_b || !r.tier || r.champion == null) continue;
    const [roleA, roleB] = orderedPair(r.role_a, r.role_b);
    const key = `${roleA}|${roleB}|${r.tier}|${r.champion}`;
    const row = merged.get(key) ?? { roleA, roleB, tier: r.tier, championId: r.champion, bans: 0 };
    row.bans += Number(r.bans);
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
  /** Côté et équipe du duo : participant A dans les matchs encore gardés. */
  const duoFrom = `
    FROM player_duo_games d
    JOIN participants pa ON pa.riot_match_id = d.riot_match_id AND pa.puuid = d.puuid_a`;
  const duoTier = 'GREATEST(d.tier_a, d.tier_b)::text';
  const duoRows = await queryRawUnsafe<RawDuoRow[]>(`
    SELECT d.role_a, d.role_b, ${duoTier} AS tier, pa.team_id,
           COUNT(*)::bigint AS games, COUNT(*) FILTER (WHERE d.win)::bigint AS wins,
           COUNT(*) FILTER (WHERE m.surrender AND NOT d.win)::bigint AS surr_for,
           COUNT(*) FILTER (WHERE m.surrender AND d.win)::bigint AS surr_against,
           COUNT(*) FILTER (WHERE pa.was_afk OR pb.was_afk)::bigint AS afk,
           SUM(t.dragon_kills)::bigint AS own_dragons, SUM(te.dragon_kills)::bigint AS enemy_dragons,
           SUM(t.baron_kills)::bigint AS own_barons, SUM(te.baron_kills)::bigint AS enemy_barons,
           SUM(t.tower_kills)::bigint AS own_towers, SUM(te.tower_kills)::bigint AS enemy_towers,
           SUM(t.horde_kills)::bigint AS own_grubs, SUM(te.horde_kills)::bigint AS enemy_grubs,
           SUM(t.rift_herald_kills)::bigint AS own_heralds, SUM(te.rift_herald_kills)::bigint AS enemy_heralds
    ${duoFrom}
    JOIN participants pb ON pb.riot_match_id = d.riot_match_id AND pb.puuid = d.puuid_b
    JOIN matchs m ON m.riot_match_id = d.riot_match_id
    JOIN teams t ON t.riot_match_id = d.riot_match_id AND t.team_id = pa.team_id
    JOIN teams te ON te.riot_match_id = d.riot_match_id AND te.team_id <> pa.team_id
    WHERE ${duoWhere}
    GROUP BY 1, 2, 3, 4
  `);

  /** Top champions de chaque rôle de la paire, par rang. */
  const pickRows = await queryRawUnsafe<RawDuoPickRow[]>(`
    WITH picks AS (
      SELECT d.role_a AS role_self, d.role_b AS role_other, d.tier_a, d.tier_b, d.champion_a AS champion, d.win
      FROM player_duo_games d WHERE ${duoWhere}
      UNION ALL
      SELECT d.role_b, d.role_a, d.tier_a, d.tier_b, d.champion_b, d.win
      FROM player_duo_games d WHERE ${duoWhere}
    ), agg AS (
      SELECT role_self, role_other, GREATEST(tier_a, tier_b)::text AS tier, champion,
             COUNT(*)::bigint AS games, COUNT(*) FILTER (WHERE win)::bigint AS wins
      FROM picks GROUP BY 1, 2, 3, 4
    )
    SELECT role_self, role_other, tier, champion, games, wins FROM (
      SELECT agg.*, ROW_NUMBER() OVER (PARTITION BY role_self, role_other, tier ORDER BY games DESC) AS rn
      FROM agg
    ) ranked WHERE rn <= ${TOP_PER_GROUP}
  `);

  /** Bans de l'équipe du duo. */
  const banRows = await queryRawUnsafe<RawDuoBanRow[]>(`
    WITH agg AS (
      SELECT d.role_a, d.role_b, ${duoTier} AS tier, pt.id_champion_ban AS champion, COUNT(*)::bigint AS bans
      ${duoFrom}
      JOIN participants pt ON pt.riot_match_id = d.riot_match_id AND pt.team_id = pa.team_id
      WHERE ${duoWhere} AND pt.id_champion_ban > 0
      GROUP BY 1, 2, 3, 4
    )
    SELECT role_a, role_b, tier, champion, bans FROM (
      SELECT agg.*, ROW_NUMBER() OVER (
        PARTITION BY LEAST(role_a, role_b), GREATEST(role_a, role_b), tier ORDER BY bans DESC
      ) AS rn
      FROM agg
    ) ranked WHERE rn <= ${TOP_PER_GROUP}
  `);

  return {
    afk: afkRows.flatMap((r) => {
      const side = teamSide(r.team_id);
      return r.role && r.tier && side
        ? [{ role: r.role, tier: r.tier, side, games: Number(r.games), afk: Number(r.afk) }]
        : [];
    }),
    duos: mergeDuoRows(duoRows),
    duoPicks: mergeDuoPicks(pickRows),
    duoBans: mergeDuoBans(banRows),
  };
}
