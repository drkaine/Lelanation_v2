/**
 * Patch catalog: `data/game/versions.json` + `version.json` for rollout windows;
 * match volumes from `match_outcome_stats` (no `active_patches` table).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { loadMatchFilters } from './RiotConfigService.js'
import { normalizePatchMajorMinor } from '../stats/statsPatchQuery.js'

export type PatchMatchCount = {
  patch: string
  matchCount: number
}

/** Total ranked matches per major.minor patch from `match_outcome_stats`. */
export async function getPatchMatchCountsFromDb(): Promise<PatchMatchCount[]> {
  if (!isDatabaseConfigured()) return []
  const rows = await queryRawUnsafe<Array<{ patch: string; cnt: string | number | bigint }>>(`
    SELECT patch, COALESCE(SUM(count_match), 0)::bigint AS cnt
    FROM match_outcome_stats
    WHERE rank_tier <> 'UNRANKED'
      AND COALESCE(NULLIF(TRIM(patch), ''), '') <> ''
    GROUP BY patch
    ORDER BY patch DESC
  `)
  return rows.map((r) => ({
    patch: String(r.patch ?? '').trim(),
    matchCount:
      typeof r.cnt === 'bigint' ? Number(r.cnt) : Number.parseInt(String(r.cnt ?? 0), 10) || 0,
  }))
}

/** Patches listed in match-filters config (versions.json-driven). */
export async function getConfiguredPatchLabels(): Promise<string[]> {
  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) return []
  return filtersRes
    .unwrap()
    .versions.map((v) => normalizePatchMajorMinor(String(v.version ?? '').trim()))
    .filter(Boolean)
}

/** @deprecated No-op — patches are LIST partitions; config + match_outcome_stats drive UI. */
export async function syncActivePatches(): Promise<number> {
  return (await getPatchMatchCountsFromDb()).length
}

/** Ensures match-filters config is loadable after a Data Dragon sync. */
export async function syncActivePatchesFromConfigAndCounts(): Promise<number> {
  const patches = await getConfiguredPatchLabels()
  await getPatchMatchCountsFromDb()
  return patches.length
}

/** @deprecated No-op */
export async function ensureActivePatchVersion(patch: string): Promise<void> {
  void normalizePatchMajorMinor(patch)
}
