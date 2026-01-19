import { Router } from 'express'
import { VersionService } from '../services/VersionService.js'

const router = Router()
const versionService = new VersionService()

/**
 * GET /api/sync/status
 * Get last synchronization date and current version
 */
router.get('/status', async (_req, res) => {
  const versionResult = await versionService.getCurrentVersion()

  if (versionResult.isErr()) {
    return res.status(500).json({
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get sync status',
        code: 'SYNC_STATUS_ERROR'
      }
    })
  }

  const versionInfo = versionResult.unwrap()

  if (!versionInfo) {
    return res.json({
      synced: false,
      message: 'No synchronization has been performed yet'
    })
  }

  return res.json({
    synced: true,
    version: versionInfo.currentVersion,
    lastSyncDate: versionInfo.lastSyncDate,
    lastSyncTimestamp: versionInfo.lastSyncTimestamp
  })
})

export default router
