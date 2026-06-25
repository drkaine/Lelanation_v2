/**
 * Verify and update champion → region mapping from LoL Universe.
 *
 * Usage:
 *   npm run script:sync-champion-regions
 *   npm run script:sync-champion-regions -- --dry-run
 */

import { syncChampionRegions } from '../services/ChampionRegionSyncService.js'

const dryRun = process.argv.includes('--dry-run')

const result = await syncChampionRegions({
  triggeredBy: 'script:sync-champion-regions',
  dryRun,
})

if (!result.ok) {
  console.error('[sync-champion-regions] Failed:', result.error)
  process.exit(1)
}

console.log('[sync-champion-regions] Done', {
  dryRun,
  universeCount: result.universeCount,
  fileUpdated: result.fileUpdated,
  applied: result.applied,
  manualReview: result.manualReview,
  unknownFactionSlugs: result.unknownFactionSlugs,
  unresolved: result.unresolved,
})
