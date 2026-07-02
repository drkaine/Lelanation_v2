import { Router } from 'express'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { FileManager } from '../utils/fileManager.js'
import { syncPublicBuildFromMatchupGuide } from '../services/matchupGuideBuildSync.js'

type MatchupGuidePayload = unknown

const router = Router()

// Stockage côté backend (public uniquement en pratique — les privés restent en localStorage) :
//   backend/data/matchup-guides/{uuid}.json
const guidesDir = join(process.cwd(), 'data', 'matchup-guides')
const GUIDE_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i

/**
 * POST /api/matchup-guides
 * Body: MatchupGuide object (public guides only — privés gérés côté client)
 */
router.post('/', async (req, res) => {
  try {
    const guide = req.body as MatchupGuidePayload & {
      id?: string
      visibility?: 'public' | 'private'
    }

    if (!guide || typeof guide !== 'object') {
      return res.status(400).json({ error: 'Invalid matchup guide payload' })
    }

    if (guide.visibility === 'private') {
      return res.status(400).json({ error: 'Private guides must be stored locally only' })
    }

    const guideId = guide.id || randomUUID()
    const fileName = `${guideId}.json`
    const filePath = join(guidesDir, fileName)

    const dirResult = await FileManager.ensureDir(guidesDir)
    if (dirResult.isErr()) {
      const err = dirResult.unwrapErr()
      return res.status(500).json({
        error: 'Failed to create matchup guides directory',
        details: err.message,
      })
    }

    const { patchStale: _patchStale, ...guideWithoutPatchStale } = guide as MatchupGuidePayload & {
      patchStale?: unknown
    }

    const guideWithMetadata = {
      ...guideWithoutPatchStale,
      id: guideId,
      visibility: 'public' as const,
      fileName,
      savedAt: new Date().toISOString(),
    }

    const writeResult = await FileManager.writeJson(filePath, guideWithMetadata)
    if (writeResult.isErr()) {
      const err = writeResult.unwrapErr()
      return res.status(500).json({
        error: 'Failed to save matchup guide file',
        details: err.message,
      })
    }

    try {
      await syncPublicBuildFromMatchupGuide(guideWithMetadata)
    } catch (syncError) {
      console.error('[Matchup Guides API] Failed to sync embedded build:', syncError)
    }

    return res.json({
      id: guideId,
      fileName,
      message: 'Matchup guide saved successfully',
    })
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/matchup-guides
 * Public guides only (fichiers {uuid}.json — jamais *_priv.json)
 */
router.get('/', async (_req, res) => {
  try {
    const { promises: fs } = await import('fs')
    await FileManager.ensureDir(guidesDir)
    const files = await fs.readdir(guidesDir)
    const guideFiles = files.filter(file => GUIDE_FILE_REGEX.test(file))

    const guides = await Promise.all(
      guideFiles.map(async file => {
        const filePath = join(guidesDir, file)
        const readResult = await FileManager.readJson(filePath)
        if (readResult.isOk()) {
          return readResult.unwrap()
        }
        return null
      })
    )

    return res.json(guides.filter(guide => guide !== null))
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to read matchup guides directory',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/matchup-guides/:id
 */
router.get('/:id', async (req, res) => {
  const guideId = req.params.id
  const filePath = join(guidesDir, `${guideId}.json`)
  const readResult = await FileManager.readJson(filePath)
  if (readResult.isErr()) {
    return res.status(404).json({ error: 'Matchup guide not found' })
  }
  return res.json(readResult.unwrap())
})

/**
 * DELETE /api/matchup-guides/:id
 */
router.delete('/:id', async (req, res) => {
  const guideId = req.params.id

  try {
    const { promises: fs } = await import('fs')
    const files = await fs.readdir(guidesDir)
    const guideFile = files.find(file => file === `${guideId}.json`)

    if (!guideFile) {
      return res.status(404).json({ error: 'Matchup guide not found' })
    }

    const filePath = join(guidesDir, guideFile)
    await fs.unlink(filePath)
    return res.json({ message: 'Matchup guide deleted successfully' })
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to delete matchup guide',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
