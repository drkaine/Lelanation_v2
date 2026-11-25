/**
 * Onglet « Régions » : grandes différences entre régions (résumé, top picks/bans/winrates, plus grands écarts).
 * Toutes les régions à la fois (pas de filtre région), filtré par patch, cache 1 h.
 */
import { isDatabaseConfigured, queryRawUnsafe } from '../db/query.js';
import { toQueryStringArrayParam } from '../utils/statsFilters.js';
import { teamMiscPatchSql } from './StatsTeamMiscService.js';

type Count = bigint | number | string | null;

export interface RegionSummaryRow {
  region: string;
  matches: Count;
  surrender: Count;
  early_surrender: Count;
  duration_sum: Count;
  participants: Count;
  afk: Count;
  kills: Count;
}
export interface RegionChampionRow {
  region: string;
  champion: Count;
  picks: Count;
  wins: Count;
}
export interface RegionBanRow {
  region: string;
  champion: Count;
  bans: Count;
}

export interface RegionSummary {
  region: string;
  matches: number;
  surrenderRate: number;
  earlySurrenderRate: number;
  afkRate: number;
  avgDurationMin: number;
  avgKills: number;
}
export interface RegionChampionStat {
  championId: number;
  rate: number;
  games: number;
}
export interface RegionTop {
  region: string;
  picked: RegionChampionStat[];
  banned: RegionChampionStat[];
  winrate: RegionChampionStat[];
}
export interface RegionSpread {
  championId: number;
  byRegion: Record<string, number>;
  spread: number;
  high: string;
  low: string;
}
export interface RegionCompare {
  regions: RegionSummary[];
  topByRegion: RegionTop[];
  spreads: { pickRate: RegionSpread[]; banRate: RegionSpread[]; winRate: RegionSpread[] };
}

/** Région comparée seulement avec assez de matchs ; winrate seulement avec assez de parties. */
export const MIN_REGION_MATCHES = 100;
export const MIN_WINRATE_GAMES = 20;
const TOP_LIMIT = 10;
const SPREAD_LIMIT = 15;

const num = (v: Count): number => (v === null ? 0 : Number(v));
const round2 = (v: number): number => Math.round(v * 100) / 100;
const pct = (part: number, total: number): number => (total > 0 ? round2((part / total) * 100) : 0);

function spreadsOf(
  regions: readonly string[],
  rateOf: (region: string, championId: number) => number | null,
  championIds: Iterable<number>,
): RegionSpread[] {
  if (regions.length < 2) return [];
  const out: RegionSpread[] = [];
  for (const championId of championIds) {
    const byRegion: Record<string, number> = {};
    let high = '';
    let low = '';
    for (const region of regions) {
      const rate = rateOf(region, championId);
      if (rate === null) continue;
      byRegion[region] = rate;
      if (high === '' || rate > (byRegion[high] ?? 0)) high = region;
      if (low === '' || rate < (byRegion[low] ?? 0)) low = region;
    }
    if (Object.keys(byRegion).length < 2) continue;
    out.push({ championId, byRegion, spread: round2((byRegion[high] ?? 0) - (byRegion[low] ?? 0)), high, low });
  }
  return out.sort((a, b) => b.spread - a.spread || a.championId - b.championId).slice(0, SPREAD_LIMIT);
}

export function buildRegionCompare(
  summaryRows: readonly RegionSummaryRow[],
  championRows: readonly RegionChampionRow[],
  banRows: readonly RegionBanRow[],
): RegionCompare {
  const regions = summaryRows
    .map((r) => {
      const matches = num(r.matches);
      return {
        region: r.region,
        matches,
        surrenderRate: pct(num(r.surrender), matches),
        earlySurrenderRate: pct(num(r.early_surrender), matches),
        afkRate: pct(num(r.afk), num(r.participants)),
        avgDurationMin: matches > 0 ? round2(num(r.duration_sum) / matches / 60) : 0,
        avgKills: matches > 0 ? round2(num(r.kills) / matches) : 0,
      };
    })
    .filter((r) => r.matches >= MIN_REGION_MATCHES)
    .sort((a, b) => b.matches - a.matches);
  const matchesOf = new Map(regions.map((r) => [r.region, r.matches]));
  const names = regions.map((r) => r.region);

  const picks = new Map<string, Map<number, { picks: number; wins: number }>>();
  for (const row of championRows) {
    if (!matchesOf.has(row.region)) continue;
    const m = picks.get(row.region) ?? new Map<number, { picks: number; wins: number }>();
    m.set(num(row.champion), { picks: num(row.picks), wins: num(row.wins) });
    picks.set(row.region, m);
  }
  const bans = new Map<string, Map<number, number>>();
  for (const row of banRows) {
    if (!matchesOf.has(row.region)) continue;
    const m = bans.get(row.region) ?? new Map<number, number>();
    m.set(num(row.champion), num(row.bans));
    bans.set(row.region, m);
  }

  const byRate = (a: RegionChampionStat, b: RegionChampionStat) => b.rate - a.rate || a.championId - b.championId;
  const topByRegion = names.map((region) => {
    const matches = matchesOf.get(region) ?? 0;
    const p = [...(picks.get(region) ?? [])];
    return {
      region,
      picked: p
        .map(([championId, s]) => ({ championId, rate: pct(s.picks, matches), games: s.picks }))
        .sort(byRate)
        .slice(0, TOP_LIMIT),
      banned: [...(bans.get(region) ?? [])]
        .map(([championId, n]) => ({ championId, rate: pct(n, matches), games: n }))
        .sort(byRate)
        .slice(0, TOP_LIMIT),
      winrate: p
        .filter(([, s]) => s.picks >= MIN_WINRATE_GAMES)
        .map(([championId, s]) => ({ championId, rate: pct(s.wins, s.picks), games: s.picks }))
        .sort(byRate)
        .slice(0, TOP_LIMIT),
    };
  });

  const pickIds = new Set([...picks.values()].flatMap((m) => [...m.keys()]));
  const banIds = new Set([...bans.values()].flatMap((m) => [...m.keys()]));
  return {
    regions,
    topByRegion,
    spreads: {
      pickRate: spreadsOf(names, (r, c) => pct(picks.get(r)?.get(c)?.picks ?? 0, matchesOf.get(r) ?? 0), pickIds),
      banRate: spreadsOf(names, (r, c) => pct(bans.get(r)?.get(c) ?? 0, matchesOf.get(r) ?? 0), banIds),
      winRate: spreadsOf(
        names,
        (r, c) => {
          const s = picks.get(r)?.get(c);
          return s && s.picks >= MIN_WINRATE_GAMES ? pct(s.wins, s.picks) : null;
        },
        pickIds,
      ),
    },
  };
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { data: RegionCompare; expiresAt: number }>();
const inflight = new Map<string, Promise<RegionCompare>>();

export function resetRegionCompareCache(): void {
  cache.clear();
  inflight.clear();
}

async function compute(versions: readonly string[]): Promise<RegionCompare> {
  const patch = teamMiscPatchSql('m.patch', versions);
  const where = patch ? `WHERE ${patch}` : '';
  const [summary, champions, banned] = await Promise.all([
    queryRawUnsafe<RegionSummaryRow[]>(`
      SELECT m.region::text AS region, COUNT(*) AS matches,
        COUNT(*) FILTER (WHERE m.surrender) AS surrender,
        COUNT(*) FILTER (WHERE m.early_surrender) AS early_surrender,
        COALESCE(SUM(m.game_duration), 0) AS duration_sum,
        COALESCE(SUM(p.participants), 0) AS participants,
        COALESCE(SUM(p.afk), 0) AS afk,
        COALESCE(SUM(p.kills), 0) AS kills
      FROM matchs m
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS participants, COUNT(*) FILTER (WHERE pa.was_afk) AS afk, SUM(pa.kills) AS kills
        FROM participants pa WHERE pa.riot_match_id = m.riot_match_id
      ) p ON true
      ${where}
      GROUP BY m.region`),
    queryRawUnsafe<RegionChampionRow[]>(`
      SELECT m.region::text AS region, pa.champion_id AS champion, COUNT(*) AS picks,
        COUNT(*) FILTER (WHERE pa.win) AS wins
      FROM participants pa JOIN matchs m ON m.riot_match_id = pa.riot_match_id
      ${where}
      GROUP BY m.region, pa.champion_id`),
    queryRawUnsafe<RegionBanRow[]>(`
      SELECT m.region::text AS region, pa.id_champion_ban AS champion,
        COUNT(DISTINCT pa.riot_match_id) AS bans
      FROM participants pa JOIN matchs m ON m.riot_match_id = pa.riot_match_id
      ${where ? `${where} AND` : 'WHERE'} pa.id_champion_ban > 0
      GROUP BY m.region, pa.id_champion_ban`),
  ]);
  return buildRegionCompare(summary, champions, banned);
}

export async function getRegionCompare(version?: string | string[] | null): Promise<RegionCompare | null> {
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
