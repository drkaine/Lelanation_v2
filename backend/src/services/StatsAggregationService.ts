/**
 * Patch cleanup service:
 * close patches that reached maxMatches (archive + remove from active list + raw cleanup).
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { loadMatchFilters } from './RiotConfigService.js'
import { closePatch } from './PatchLifecycleService.js'

type LoggerType = ReturnType<typeof createRiotPollerLogger>

/**
 * Load active patch counters and close patches that have reached their target.
 * Contrainte : on ne clôture un patch que si games_number >= game_number_max.
 * Utilise close_patch() SQL : copie des tables agg_* vers les archives unifiées archive_agg_* (tous les patches), purge des hot agg_* + ingest pour le patch, gel de la ligne `active_patches` (archived_at, is_current).
 */
export async function runPatchCleanupFromConfig(logger?: LoggerType): Promise<void> {
  if (!isDatabaseConfigured()) return

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
      const summary = await closePatch(patch)
      if (logger) void logger.step('Patch cleanup complete', { patch, summary })
    } catch (err) {
      if (logger) void logger.alerte('close_patch failed', { patch, error: String(err) })
    }
  }
}
