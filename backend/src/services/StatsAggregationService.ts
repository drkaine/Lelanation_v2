/**
 * StatsAggregationService (Phase 2)
 *
 * Single responsibility: run patch cleanup from config (close patches that have
 * reached maxMatches → archive MVs + remove from active_patches + delete raw match data).
 *
 * Incremental aggregation into champion_*_stats / team_core_stats has been removed;
 * stats are computed only via materialized views from raw data (core_stat_id).
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { loadMatchFilters } from './RiotConfigService.js'

type LoggerType = ReturnType<typeof createRiotPollerLogger>

/**
 * Load match-filter config and close patches that have reached their target (archivage + suppression brute).
 * Contrainte : on ne clôture un patch que si le nombre de matchs pour ce patch est >= maxMatches
 * (valeur par version dans match-filters.json). Seules les versions avec completed: true sont éligibles.
 * Utilise close_patch() SQL : snapshot des MVs vers archive_*, retrait du patch des actifs, suppression des matchs bruts.
 */
export async function runPatchCleanupFromConfig(logger?: LoggerType): Promise<void> {
  if (!isDatabaseConfigured()) return

  const { closePatch } = await import('./MaterializedViewService.js')

  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) return

  const filters = filtersRes.unwrap()
  const currentVersion = filters.versions.find(v => !v.completed)
  if (!currentVersion) return

  const currentPatch = currentVersion.version

  for (const v of filters.versions) {
    if (!v.completed || v.maxMatches == null || v.maxMatches <= 0) continue

    const patch = v.version
    if (patch === currentPatch) continue

    const countResult = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM matchs
      WHERE (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)) = ${patch}
    `
    const count = Number(countResult[0]?.cnt ?? 0)
    // Ne clôturer que si au moins maxMatches (match-filters.json) ont été collectés pour ce patch
    if (count < v.maxMatches) continue

    if (logger) void logger.step('Patch cleanup: closing patch (archive + delete raw)', { patch, matchCount: count })
    try {
      await closePatch(patch)
      if (logger) void logger.step('Patch cleanup complete', { patch })
    } catch (err) {
      if (logger) void logger.alerte('close_patch failed', { patch, error: String(err) })
    }
  }
}
