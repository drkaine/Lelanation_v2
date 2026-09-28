import { Router, type Request, type Response } from 'express'
import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { VersionService } from '../services/VersionService.js'
import { NotFoundError } from '../utils/errors.js'
import { readGameDataFile, readVersionedGameData, type GameDataDirs } from './gameDataFiles.js'

const router = Router()
const versionService = new VersionService()

/** Riot locale codes look like "fr_FR" / "en_US": anything else must never reach a file path. */
const LANGUAGE_REGEX = /^[a-z]{2,3}_[A-Z]{2}$/
const DEFAULT_LANGUAGE = 'fr_FR'

function readLanguage(raw: unknown): string {
  return typeof raw === 'string' && LANGUAGE_REGEX.test(raw) ? raw : DEFAULT_LANGUAGE
}

const GAME_DATA_CACHE_MAX_AGE = 3600

// Paths for data sources (backend first, frontend as fallback)
const backendDataDir = join(process.cwd(), 'data', 'game')
const frontendDataDir = join(process.cwd(), '..', 'frontend', 'public', 'data', 'game')
const dataDirs: GameDataDirs = { backendDir: backendDataDir, frontendDir: frontendDataDir }

/** Sends the file (cached 1 h), or 404 / 500 with the given messages. */
function sendGameData(
  res: Response,
  readResult: Awaited<ReturnType<typeof readGameDataFile>>,
  messages: { notFound: string; failed: string }
) {
  if (readResult.isErr()) {
    if (readResult.unwrapErr() instanceof NotFoundError) {
      return res.status(404).json({ error: messages.notFound })
    }
    return res.status(500).json({ error: messages.failed })
  }
  res.set('Cache-Control', `public, max-age=${GAME_DATA_CACHE_MAX_AGE}`)
  return res.json(readResult.unwrap())
}

/** GET handler serving a Data Dragon file of the current patch in the requested language (`?lang=`). */
function serveGameData(label: string, files: (req: Request) => readonly string[]) {
  const messages = {
    notFound: `${label.charAt(0).toUpperCase()}${label.slice(1)} data not found`,
    failed: `Failed to read ${label} data`,
  }
  return async (req: Request, res: Response) => {
    const language = readLanguage(req.query.lang)
    const versionResult = await versionService.getCurrentVersion()
    if (versionResult.isErr()) {
      return res.status(500).json({ error: 'Failed to get game version' })
    }
    const versionInfo = versionResult.unwrap()
    if (!versionInfo) {
      return res.status(404).json({ error: 'No game version found' })
    }
    const readResult = await readVersionedGameData(
      dataDirs,
      versionInfo.currentVersion,
      language,
      files(req)
    )
    return sendGameData(res, readResult, messages)
  }
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
  const readResult = await readGameDataFile(
    join(backendDataDir, 'versions.json'),
    join(frontendDataDir, 'versions.json')
  )
  return sendGameData(res, readResult, {
    notFound: 'versions.json not found',
    failed: 'Failed to read versions data',
  })
})

/** Champions (`?full=true`: championFull.json; otherwise champion.json, championFull.json when missing). */
router.get(
  '/champions',
  serveGameData('champions', req =>
    req.query.full === 'true' ? ['championFull.json'] : ['champion.json', 'championFull.json']
  )
)

router.get('/items', serveGameData('items', () => ['item.json']))

router.get('/runes', serveGameData('runes', () => ['runesReforged.json']))

router.get('/summoner-spells', serveGameData('summoner spells', () => ['summoner.json']))

export default router
