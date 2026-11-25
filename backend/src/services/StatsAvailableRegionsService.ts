/**
 * Régions ayant au moins un match en base : seules ces régions sont proposées dans le filtre stats.
 * Une sonde EXISTS par valeur de l'enum (index idx_matchs_region) : < 1 ms. Cache 10 min.
 */
import { isDatabaseConfigured, queryRawUnsafe } from '../db/query.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
let cached: { regions: string[]; expiresAt: number } | null = null;

export function resetAvailableRegionsCache(): void {
  cached = null;
}

export async function getAvailableRegions(): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  if (cached && cached.expiresAt > Date.now()) return cached.regions;
  try {
    const rows = await queryRawUnsafe<Array<{ region: string }>>(`
      SELECT r::text AS region
      FROM unnest(enum_range(NULL::lol_region)) WITH ORDINALITY AS e(r, ord)
      WHERE EXISTS (SELECT 1 FROM matchs m WHERE m.region = e.r)
      ORDER BY e.ord
    `);
    const regions = rows.map((row) => row.region);
    cached = { regions, expiresAt: Date.now() + CACHE_TTL_MS };
    return regions;
  } catch {
    return [];
  }
}
