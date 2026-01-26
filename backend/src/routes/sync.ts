import { Router } from 'express'
import { DataDragonService } from '../services/DataDragonService.js'
import { CommunityDragonService } from '../services/CommunityDragonService.js'
import { VersionService } from '../services/VersionService.js'
import { retryWithBackoff } from '../utils/retry.js'

const router = Router()
const dataDragonService = new DataDragonService()
const communityDragonService = new CommunityDragonService()
const versionService = new VersionService()

/**
 * Get sync status
 */
router.get('/status', async (_req, res) => {
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    return res.status(500).json({ error: versionResult.unwrapErr().message })
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
 * Trigger manual sync
 */
router.post('/trigger', async (_req, res) => {
  console.log('[Manual Sync] Starting Data Dragon synchronization...')

  try {
    // Check for new version first
    const versionCheckResult = await versionService.checkForNewVersion()
    if (versionCheckResult.isErr()) {
      const error = versionCheckResult.unwrapErr()
      console.error('[Manual Sync] Failed to check version:', error)
      return res.status(500).json({
        error: 'Failed to check version',
        details: error.message
      })
    }

    const versionInfo = versionCheckResult.unwrap()
    const versionToSync = versionInfo.latest

    console.log(`[Manual Sync] Syncing game data for version: ${versionToSync}`)

    // Sync with retry logic
    const syncResult = await retryWithBackoff(
      () => dataDragonService.syncGameData(versionToSync),
      {
        maxRetries: 10,
        initialDelay: 1000,
        maxDelay: 30000,
        multiplier: 2
      }
    )

    if (syncResult.isErr()) {
      const error = syncResult.unwrapErr()
      console.error('[Manual Sync] Data Dragon sync failed after retries:', error)
      return res.status(500).json({
        error: 'Sync failed after retries',
        details: error.message
      })
    }

    const syncData = syncResult.unwrap()

    // Update version info
    const updateResult = await versionService.updateVersion(syncData.version)
    if (updateResult.isErr()) {
      console.error('[Manual Sync] Failed to update version info:', updateResult.unwrapErr())
      // Don't fail the sync if version update fails
    }

    console.log(
      `[Manual Sync] Data Dragon sync completed successfully. Version: ${syncData.version}, Synced at: ${syncData.syncedAt.toISOString()}`
    )

    return res.json({
      success: true,
      version: syncData.version,
      syncedAt: syncData.syncedAt.toISOString()
    })
  } catch (error) {
    console.error('[Manual Sync] Unexpected error:', error)
    return res.status(500).json({
      error: 'Unexpected error during sync',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Trigger manual Community Dragon sync
 */
router.post('/community-dragon', async (_req, res) => {
  console.log('[Manual Sync] Starting Community Dragon synchronization...')

  try {
    // Sync with retry logic
    const syncResult = await retryWithBackoff(
      () => communityDragonService.syncAllChampions(),
      {
        maxRetries: 3,
        initialDelay: 5000,
        maxDelay: 30000,
        multiplier: 2,
      }
    )

    if (syncResult.isErr()) {
      const error = syncResult.unwrapErr()
      console.error('[Manual Sync] Community Dragon sync failed after retries:', error)
      return res.status(500).json({
        error: 'Sync failed after retries',
        details: error.message,
      })
    }

    const syncData = syncResult.unwrap()

    console.log(
      `[Manual Sync] Community Dragon sync completed. Synced: ${syncData.synced}, Failed: ${syncData.failed}, Skipped: ${syncData.skipped}`
    )

    return res.json({
      success: true,
      synced: syncData.synced,
      failed: syncData.failed,
      skipped: syncData.skipped,
      errors: syncData.errors,
    })
  } catch (error) {
    console.error('[Manual Sync] Unexpected error:', error)
    return res.status(500).json({
      error: 'Unexpected error during sync',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
