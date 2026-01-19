import { Router } from 'express'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { VersionService } from '../services/VersionService.js'
import { NotFoundError } from '../utils/errors.js'

const router = Router()
const versionService = new VersionService()

/**
 * Get current game version
 */
router.get('/version', async (_req, res) => {
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    return res.status(500).json({ error: versionResult.unwrapErr().message })
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo) {
    return res.status(404).json({ error: 'No game version found' })
  }

  return res.json({ version: versionInfo.currentVersion })
})

/**
 * Get champions data
 */
router.get('/champions', async (req, res) => {
  const language = (req.query.lang as string) || 'fr_FR'

  // Get current version
  const versionResult = await versionService.getCurrentVersion()
  if (versionResult.isErr()) {
    return res.status(500).json({ error: 'Failed to get game version' })
  }

  const versionInfo = versionResult.unwrap()
  if (!versionInfo) {
    return res.status(404).json({ error: 'No game version found' })
  }

  const championsPath = join(
    process.cwd(),
    'data',
    'game',
    versionInfo.currentVersion,
    language,
    'champion.json'
  )

  const readResult = await FileManager.readJson(championsPath)
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

  const itemsPath = join(
    process.cwd(),
    'data',
    'game',
    versionInfo.currentVersion,
    language,
    'item.json'
  )

  const readResult = await FileManager.readJson(itemsPath)
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

  const runesPath = join(
    process.cwd(),
    'data',
    'game',
    versionInfo.currentVersion,
    language,
    'runesReforged.json'
  )

  const readResult = await FileManager.readJson(runesPath)
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

  const spellsPath = join(
    process.cwd(),
    'data',
    'game',
    versionInfo.currentVersion,
    language,
    'summoner.json'
  )

  const readResult = await FileManager.readJson(spellsPath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr() instanceof NotFoundError) {
      return res.status(404).json({ error: 'Summoner spells data not found' })
    }
    return res.status(500).json({ error: 'Failed to read summoner spells data' })
  }

  return res.json(readResult.unwrap())
})

export default router
