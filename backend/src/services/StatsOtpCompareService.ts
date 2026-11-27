/**
 * Onglet « OTP » : grandes différences entre joueurs flaggés OTP (`otp_players`) et les autres.
 * Catégorie seulement : aucun joueur n'est nommé ni renvoyé. Filtré par patch, cache 1 h.
 */
import { isDatabaseConfigured, queryRawUnsafe } from '../db/query.js';
import { toQueryStringArrayParam } from '../utils/statsFilters.js';
import { spreadsOf, type RegionChampionStat, type RegionSpread } from './StatsRegionCompareService.js';
import { teamMiscPatchSql } from './StatsTeamMiscService.js';
import { getStatsLimits } from './StatsLimitsService.js';

type Count = bigint | number | string | null;
export type OtpGroup = 'otp' | 'others';

export interface OtpGroupRow {
  grp: string;
  games: Count;
  wins: Count;
  kills: Count;
  deaths: Count;
  assists: Count;
  afk: Count;
  champions: Count;
}
export interface OtpChampionRow {
  grp: string;
  champion: Count;
  picks: Count;
  wins: Count;
}
export interface OtpGroupSummary {
  group: OtpGroup;
  games: number;
  winRate: number;
  kda: number;
  avgKills: number;
  afkRate: number;
  champions: number;
}
export interface OtpTop {
  group: OtpGroup;
  picked: RegionChampionStat[];
  winrate: RegionChampionStat[];
}
export interface OtpPopulationRow {
  region: string;
  tier: string | null;
  players: Count;
}
export interface OtpPopulation {
  total: number;
  byRegion: { region: string; players: number; pct: number }[];
  byTier: { tier: string; players: number; pct: number }[];
  cells: { region: string; tier: string; players: number }[];
}
export interface OtpCompare {
  /** Joueurs OTP actuels (`otp_players`, tous patchs) par région et tier courant. */
  population: OtpPopulation;
  groups: OtpGroupSummary[];
  top: OtpTop[];
  spreads: { pickRate: RegionSpread[]; winRate: RegionSpread[] };
}

export const MIN_OTP_WINRATE_GAMES = 10;
const GROUPS: readonly OtpGroup[] = ['otp', 'others'];

const num = (v: Count): number => (v === null ? 0 : Number(v));
const round2 = (v: number): number => Math.round(v * 100) / 100;
const pct = (part: number, total: number): number => (total > 0 ? round2((part / total) * 100) : 0);
const asGroup = (g: string): OtpGroup | null => (g === 'otp' || g === 'others' ? g : null);

const TIER_ORDER = [
  'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED',
];
const pct1 = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

export function buildOtpPopulation(rows: readonly OtpPopulationRow[]): OtpPopulation {
  const cells = rows
    .map((r) => ({ region: String(r.region), tier: r.tier ?? 'UNRANKED', players: num(r.players) }))
    .filter((c) => c.players > 0);
  const total = cells.reduce((s, c) => s + c.players, 0);
  const sum = (key: 'region' | 'tier') => {
    const m = new Map<string, number>();
    for (const c of cells) m.set(c[key], (m.get(c[key]) ?? 0) + c.players);
    return [...m];
  };
  const rank = (t: string) => {
    const i = TIER_ORDER.indexOf(t);
    return i < 0 ? TIER_ORDER.length : i;
  };
  return {
    total,
    byRegion: sum('region')
      .map(([region, players]) => ({ region, players, pct: pct1(players, total) }))
      .sort((a, b) => b.players - a.players || a.region.localeCompare(b.region)),
    byTier: sum('tier')
      .map(([tier, players]) => ({ tier, players, pct: pct1(players, total) }))
      .sort((a, b) => rank(a.tier) - rank(b.tier)),
    cells,
  };
}

export function buildOtpCompare(
  groupRows: readonly OtpGroupRow[],
  championRows: readonly OtpChampionRow[],
  populationRows: readonly OtpPopulationRow[] = [],
): OtpCompare {
  const { compareTopLimit: topLimit, otpWinrateMinGames: minWinrateGames } = getStatsLimits();
  const groups: OtpGroupSummary[] = [];
  for (const row of groupRows) {
    const group = asGroup(row.grp);
    if (!group) continue;
    const games = num(row.games);
    if (games <= 0) continue;
    const deaths = num(row.deaths);
    groups.push({
      group,
      games,
      winRate: pct(num(row.wins), games),
      kda: round2((num(row.kills) + num(row.assists)) / Math.max(1, deaths)),
      avgKills: round2(num(row.kills) / games),
      afkRate: pct(num(row.afk), games),
      champions: num(row.champions),
    });
  }
  groups.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
  const gamesOf = new Map<string, number>(groups.map((g) => [g.group, g.games]));
  const names = groups.map((g) => g.group);

  const picks = new Map<string, Map<number, { picks: number; wins: number }>>();
  for (const row of championRows) {
    const group = asGroup(row.grp);
    if (!group || !gamesOf.has(group)) continue;
    const m = picks.get(group) ?? new Map<number, { picks: number; wins: number }>();
    m.set(num(row.champion), { picks: num(row.picks), wins: num(row.wins) });
    picks.set(group, m);
  }

  const byRate = (a: RegionChampionStat, b: RegionChampionStat) => b.rate - a.rate || a.championId - b.championId;
  const top = names.map((group) => {
    const games = gamesOf.get(group) ?? 0;
    const p = [...(picks.get(group) ?? [])];
    return {
      group,
      picked: p
        .map(([championId, s]) => ({ championId, rate: pct(s.picks, games), games: s.picks }))
        .sort(byRate)
        .slice(0, topLimit),
      winrate: p
        .filter(([, s]) => s.picks >= minWinrateGames)
        .map(([championId, s]) => ({ championId, rate: pct(s.wins, s.picks), games: s.picks }))
        .sort(byRate)
        .slice(0, topLimit),
    };
  });

  const ids = new Set([...picks.values()].flatMap((m) => [...m.keys()]));
  const stat = (g: string, c: number) => picks.get(g)?.get(c);
  return {
    population: buildOtpPopulation(populationRows),
    groups,
    top,
    spreads: {
      pickRate: spreadsOf(names, (g, c) => pct(stat(g, c)?.picks ?? 0, gamesOf.get(g) ?? 0), ids),
      winRate: spreadsOf(
        names,
        (g, c) => {
          const s = stat(g, c);
          return s && s.picks >= minWinrateGames ? pct(s.wins, s.picks) : null;
        },
        ids,
      ),
    },
  };
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { data: OtpCompare; expiresAt: number }>();
const inflight = new Map<string, Promise<OtpCompare>>();

export function resetOtpCompareCache(): void {
  cache.clear();
  inflight.clear();
}

const GROUP_EXPR = `CASE WHEN EXISTS (SELECT 1 FROM otp_players o WHERE o.puuid = pa.puuid) THEN 'otp' ELSE 'others' END`;

async function compute(versions: readonly string[]): Promise<OtpCompare> {
  const patch = teamMiscPatchSql('m.patch', versions);
  const where = patch ? `WHERE ${patch}` : '';
  const from = `FROM participants pa JOIN matchs m ON m.riot_match_id = pa.riot_match_id ${where}`;
  const [groupRows, championRows, populationRows] = await Promise.all([
    queryRawUnsafe<OtpGroupRow[]>(`
      SELECT ${GROUP_EXPR} AS grp, COUNT(*) AS games, COUNT(*) FILTER (WHERE pa.win) AS wins,
        COALESCE(SUM(pa.kills), 0) AS kills, COALESCE(SUM(pa.deaths), 0) AS deaths,
        COALESCE(SUM(pa.assists), 0) AS assists, COUNT(*) FILTER (WHERE pa.was_afk) AS afk,
        COUNT(DISTINCT pa.champion_id) AS champions
      ${from}
      GROUP BY 1`),
    queryRawUnsafe<OtpChampionRow[]>(`
      SELECT ${GROUP_EXPR} AS grp, pa.champion_id AS champion, COUNT(*) AS picks,
        COUNT(*) FILTER (WHERE pa.win) AS wins
      ${from}
      GROUP BY 1, pa.champion_id`),
    // Tier courant = dernier relevé du balayage des rangs ; agrégé, aucun joueur renvoyé.
    queryRawUnsafe<OtpPopulationRow[]>(`
      WITH latest AS (
        SELECT DISTINCT ON (h.puuid) h.puuid, h.rank_tier::text AS tier
        FROM player_rank_history h JOIN otp_players o ON o.puuid = h.puuid
        ORDER BY h.puuid, h.date DESC
      )
      SELECT p.region::text AS region, l.tier, COUNT(*) AS players
      FROM otp_players o JOIN players p ON p.puuid = o.puuid LEFT JOIN latest l ON l.puuid = o.puuid
      GROUP BY 1, 2`),
  ]);
  return buildOtpCompare(groupRows, championRows, populationRows);
}

export async function getOtpCompare(version?: string | string[] | null): Promise<OtpCompare | null> {
  if (!isDatabaseConfigured()) return null;
  const versions = toQueryStringArrayParam(version ?? undefined);
  const key = versions.join(',');
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const running = inflight.get(key);
  if (running) return running;
  const job = compute(versions).then((data) => {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  });
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}
