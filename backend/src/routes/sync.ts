import { Router } from 'express'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { VersionService } from '../services/VersionService.js'
import { requireAdmin } from '../utils/adminAuth.js'

const router = Router()
const communityDragonService = new CommunityDragonService()
const versionService = new VersionService()

/**
 * Get sync status
 */
router.get('/status', async (_req, res) => {
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    console.error('[Sync] version read failed:', versionResult.unwrapErr())
    return res.status(500).json({ error: 'Failed to read sync status' })
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo) {
    return res.json({
      hasVersion: false,
      currentVersion: null,
      lastSync: null
    })
  }

  return res.json({
    hasVersion: true,
    currentVersion: versionInfo.currentVersion,
    lastSync: versionInfo.lastSyncDate
  })
})

/**
 * Trigger manual Community Dragon sync (admin only: five heavy outbound syncs).
 */
router.post('/community-dragon', ...requireAdmin, async (_req, res) => {

  try {
    const [emblemsResult, objectiveIconsResult, pingIconsResult, mapPlannerResult, kaynHudResult] =
      await Promise.all([
        communityDragonService.syncRankedEmblems(),
        communityDragonService.syncScoreboardObjectiveIcons(),
        communityDragonService.syncMinimapPingIcons(),
        communityDragonService.syncMapPlannerAssets(),
        communityDragonService.syncKaynHudImages(),
      ])

    if (
      emblemsResult.isErr() ||
      objectiveIconsResult.isErr() ||
      pingIconsResult.isErr() ||
      mapPlannerResult.isErr() ||
      kaynHudResult.isErr()
    ) {
      const error = emblemsResult.isErr()
        ? emblemsResult.unwrapErr()
        : objectiveIconsResult.isErr()
          ? objectiveIconsResult.unwrapErr()
          : pingIconsResult.isErr()
            ? pingIconsResult.unwrapErr()
            : mapPlannerResult.isErr()
              ? mapPlannerResult.unwrapErr()
              : kaynHudResult.unwrapErr()
      console.error('[Manual Sync] Community Dragon assets sync failed:', error)
      return res.status(500).json({ error: 'Community Dragon assets sync failed' })
    }

    const emblems = emblemsResult.unwrap()
    const objectiveIcons = objectiveIconsResult.unwrap()
    const pingIcons = pingIconsResult.unwrap()
    const mapPlanner = mapPlannerResult.unwrap()
    const kaynHud = kaynHudResult.unwrap()
    const synced =
      emblems.synced + objectiveIcons.synced + pingIcons.synced + mapPlanner.synced + kaynHud.synced
    const failed =
      emblems.failed + objectiveIcons.failed + pingIcons.failed + mapPlanner.failed + kaynHud.failed
    const errors = [
      ...emblems.errors,
      ...objectiveIcons.errors,
      ...pingIcons.errors,
      ...mapPlanner.errors,
      ...kaynHud.errors,
    ]
    
    return res.json({
      success: true,
      synced,
      failed,
      skipped: 0,
      errors,
    })
  } catch (error) {
    console.error('[Manual Sync] Unexpected error:', error)
    return res.status(500).json({ error: 'Unexpected error during sync' })
  }
})

export default router
