/**
 * Régions ayant au moins un match en base : seules ces régions sont proposées dans le filtre stats.
 * Une sonde EXISTS par valeur de l'enum (index idx_matchs_region) : < 1 ms. Cache 10 min.
 */
import { isDatabaseConfigured, queryRawUnsafe } from '../db/query.js';
import { teamMiscPatchSql } from './StatsTeamMiscService.js';
import { toQueryStringArrayParam } from '../utils/statsFilters.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
/** Clé = patchs du filtre (vide = tous). */
const cache = new Map<string, { regions: string[]; expiresAt: number }>();

export function resetAvailableRegionsCache(): void {
  cache.clear();
}

/** Régions ayant des matchs, sur les patchs du filtre s'il y en a (`16.23,16.22`). */
export async function getAvailableRegions(version?: string | string[] | null): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const versions = toQueryStringArrayParam(version);
  const key = versions.join(',');
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.regions;
  const patch = teamMiscPatchSql('m.patch', versions);
  try {
    const rows = await queryRawUnsafe<Array<{ region: string }>>(`
      SELECT r::text AS region
      FROM unnest(enum_range(NULL::lol_region)) WITH ORDINALITY AS e(r, ord)
      WHERE EXISTS (SELECT 1 FROM matchs m WHERE m.region = e.r${patch ? ` AND ${patch}` : ''})
      ORDER BY e.ord
    `);
    const regions = rows.map((row) => row.region);
    cache.set(key, { regions, expiresAt: Date.now() + CACHE_TTL_MS });
    return regions;
  } catch {
    return [];
  }
}
