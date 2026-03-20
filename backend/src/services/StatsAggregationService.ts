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
 * Load active patch counters and close patches that have reached their target.
 * Contrainte : on ne clôture un patch que si games_number >= game_number_max.
 * Utilise close_patch() SQL : snapshot des MVs vers archive_*, retrait du patch des actifs, suppression des matchs bruts.
 */
export async function runPatchCleanupFromConfig(logger?: LoggerType): Promise<void> {
  if (!isDatabaseConfigured()) return

  const { closePatch } = await import('./MaterializedViewService.js')

  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) return

  const filters = filtersRes.unwrap()
  const currentPatch = filters.versions[filters.versions.length - 1]?.version
  if (!currentPatch) return

  const candidates = await prisma.activePatch.findMany({
    where: { gameNumberMax: { gt: 0 } },
    select: { gameVersion: true, gamesNumber: true, gameNumberMax: true },
  })

  for (const c of candidates) {
    const patch = c.gameVersion
    if (patch === currentPatch) continue
    if (c.gamesNumber < c.gameNumberMax) continue
    if (logger) void logger.step('Patch cleanup: closing patch (archive + delete raw)', { patch, matchCount: c.gamesNumber })
    try {
      await closePatch(patch)
      if (logger) void logger.step('Patch cleanup complete', { patch })
    } catch (err) {
      if (logger) void logger.alerte('close_patch failed', { patch, error: String(err) })
    }
  }
}
