import { Router } from 'express'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { VersionService } from '../services/VersionService.js'
import { NotFoundError } from '../utils/errors.js'

const router = Router()
const versionService = new VersionService()

// Paths for data sources (backend first, frontend as fallback)
const backendDataDir = join(process.cwd(), 'data', 'game')
const frontendDataDir = join(process.cwd(), '..', 'frontend', 'public', 'data', 'game')

/**
 * Try to read JSON file from backend, fallback to frontend public directory
 * This allows the API to work even after backend data is deleted (saves disk space)
 */
async function readGameDataFile(
  backendPath: string,
  frontendPath: string
): Promise<ReturnType<typeof FileManager.readJson>> {
  // Try backend first
  const backendResult = await FileManager.readJson(backendPath)
  if (backendResult.isOk()) {
    return backendResult
  }

  // If backend file doesn't exist, try frontend public directory
  const frontendResult = await FileManager.readJson(frontendPath)
  if (frontendResult.isOk()) {
    console.debug(`[GameData API] Reading from frontend public: ${frontendPath}`)
    return frontendResult
  }

  // Both failed, return the frontend error (more recent)
  return frontendResult
}

/**
 * Get current game version
 * Tries backend first, then frontend public directory
 */
router.get('/version', async (_req, res) => {
  // Try backend first
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isOk()) {
    const versionInfo = versionResult.unwrap()
    if (versionInfo) {
      return res.json({ version: versionInfo.currentVersion })
    }
  }

  // Fallback to frontend public directory
  const frontendVersionPath = join(frontendDataDir, 'version.json')
  const frontendResult = await FileManager.readJson<{ currentVersion: string }>(
    frontendVersionPath
  )

  if (frontendResult.isOk()) {
    const versionInfo = frontendResult.unwrap()
    if (versionInfo?.currentVersion) {
      console.debug(`[GameData API] Reading version from frontend public: ${frontendVersionPath}`)
      return res.json({ version: versionInfo.currentVersion })
    }
  }

  return res.status(404).json({ error: 'No game version found' })
})

/**
 * Get versions recap (version + release date per patch)
 * Used for match collection (patch filter), archiving, stats by patch.
 */
router.get('/versions', async (_req, res) => {
  const versionsPath = join(backendDataDir, 'versions.json')
  const frontendVersionsPath = join(frontendDataDir, 'versions.json')
  const readResult = await readGameDataFile(versionsPath, frontendVersionsPath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr() instanceof NotFoundError) {
      return res.status(404).json({ error: 'versions.json not found' })
    }
    return res.status(500).json({ error: 'Failed to read versions data' })
  }
  return res.json(readResult.unwrap())
})

/**
 * Get champions data
 */
router.get('/champions', async (req, res) => {
  const language = (req.query.lang as string) || 'fr_FR'
  const full = req.query.full === 'true' // Check if full data is requested

  // Get current version
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    return res.status(500).json({ error: 'Failed to get game version' })
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo) {
    return res.status(404).json({ error: 'No game version found' })
  }

  const filename = full ? 'championFull.json' : 'champion.json'
  const backendPath = join(
    backendDataDir,
    versionInfo.currentVersion,
    language,
    filename
  )
  const frontendPath = join(
    frontendDataDir,
    versionInfo.currentVersion,
    language,
    filename
  )

  const readResult = await readGameDataFile(backendPath, frontendPath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr() instanceof NotFoundError) {
      return res.status(404).json({ error: 'Champions data not found' })
    }
    return res.status(500).json({ error: 'Failed to read champions data' })
  }

  return res.json(readResult.unwrap())
})

/**
 * Get items data
 */
router.get('/items', async (req, res) => {
  const language = (req.query.lang as string) || 'fr_FR'

  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    return res.status(500).json({ error: 'Failed to get game version' })
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo) {
    return res.status(404).json({ error: 'No game version found' })
  }

  const backendPath = join(
    backendDataDir,
    versionInfo.currentVersion,
    language,
    'item.json'
  )
  const frontendPath = join(
    frontendDataDir,
    versionInfo.currentVersion,
    language,
    'item.json'
  )

  const readResult = await readGameDataFile(backendPath, frontendPath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr() instanceof NotFoundError) {
      return res.status(404).json({ error: 'Items data not found' })
    }
    return res.status(500).json({ error: 'Failed to read items data' })
  }

  return res.json(readResult.unwrap())
})

/**
 * Get runes data
 */
router.get('/runes', async (req, res) => {
  const language = (req.query.lang as string) || 'fr_FR'

  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    return res.status(500).json({ error: 'Failed to get game version' })
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo) {
    return res.status(404).json({ error: 'No game version found' })
  }

  const backendPath = join(
    backendDataDir,
    versionInfo.currentVersion,
    language,
    'runesReforged.json'
  )
  const frontendPath = join(
    frontendDataDir,
    versionInfo.currentVersion,
    language,
    'runesReforged.json'
  )

  const readResult = await readGameDataFile(backendPath, frontendPath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr() instanceof NotFoundError) {
      return res.status(404).json({ error: 'Runes data not found' })
    }
    return res.status(500).json({ error: 'Failed to read runes data' })
  }

  return res.json(readResult.unwrap())
})

/**
 * Get summoner spells data
 */
router.get('/summoner-spells', async (req, res) => {
  const language = (req.query.lang as string) || 'fr_FR'

  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    return res.status(500).json({ error: 'Failed to get game version' })
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo) {
    return res.status(404).json({ error: 'No game version found' })
  }

  const backendPath = join(
    backendDataDir,
    versionInfo.currentVersion,
    language,
    'summoner.json'
  )
  const frontendPath = join(
    frontendDataDir,
    versionInfo.currentVersion,
    language,
    'summoner.json'
  )

  const readResult = await readGameDataFile(backendPath, frontendPath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr() instanceof NotFoundError) {
      return res.status(404).json({ error: 'Summoner spells data not found' })
    }
    return res.status(500).json({ error: 'Failed to read summoner spells data' })
  }

  return res.json(readResult.unwrap())
})

export default router
