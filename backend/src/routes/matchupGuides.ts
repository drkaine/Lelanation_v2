import { Router } from 'express'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { FileManager } from '../utils/fileManager.js'
import { BUILD_EDIT_SECRET_HEADER, stripEditSecret, verifyEditSecret } from '../utils/buildEditAuth.js'
import { createRateLimit } from '../utils/httpRateLimit.js'
import { isValidGuideId, resolveGuideFilePath } from '../utils/matchupGuideAccess.js'
import { syncPublicBuildFromMatchupGuide } from '../services/matchupGuideBuildSync.js'
import {
  compactMatchupGuideForStorage,
  resolveMatchupGuideBuild,
} from '../services/matchupGuideBuildResolve.js'

type MatchupGuidePayload = unknown

const router = Router()

// Stockage côté backend (public uniquement en pratique — les privés restent en localStorage) :
//   backend/data/matchup-guides/{uuid}.json
const guidesDir = join(process.cwd(), 'data', 'matchup-guides')
const guideWriteRateLimit = createRateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'guides-write' })

// The list re-reads and resolves every guide: keep it a few seconds, drop it on any write.
const LIST_CACHE_TTL_MS = 30_000
let listCache: { at: number; guides: unknown[] } | null = null

async function readStoredGuide(filePath: string): Promise<Record<string, unknown> | null> {
  const readResult = await FileManager.readJson(filePath)
  return readResult.isOk() ? (readResult.unwrap() as Record<string, unknown>) : null
}

/**
 * POST /api/matchup-guides
 * Body: MatchupGuide object (public guides only — privés gérés côté client)
 */
router.post('/', guideWriteRateLimit, async (req, res) => {
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

    if (guide.id !== undefined && guide.id !== null && guide.id !== '' && !isValidGuideId(guide.id)) {
      return res.status(400).json({ error: 'Invalid matchup guide id' })
    }
    const guideId = guide.id || randomUUID()
    const fileName = `${guideId}.json`
    const filePath = resolveGuideFilePath(guidesDir, guideId)
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid matchup guide id' })
    }

    const auth = verifyEditSecret(await readStoredGuide(filePath), req.header(BUILD_EDIT_SECRET_HEADER))
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error })
    }

    const dirResult = await FileManager.ensureDir(guidesDir)
    if (dirResult.isErr()) {
      console.error('[Matchup Guides API] ensureDir failed:', dirResult.unwrapErr())
      return res.status(500).json({ error: 'Failed to create matchup guides directory' })
    }

    const {
      patchStale: _patchStale,
      editSecret: _editSecret,
      ...guideWithoutPatchStale
    } = guide as MatchupGuidePayload & { patchStale?: unknown; editSecret?: unknown }

    const guideWithMetadata = {
      ...guideWithoutPatchStale,
      id: guideId,
      visibility: 'public' as const,
      fileName,
      savedAt: new Date().toISOString(),
    }

    try {
      await syncPublicBuildFromMatchupGuide(guideWithMetadata)
    } catch (syncError) {
      console.error('[Matchup Guides API] Failed to sync embedded build:', syncError)
    }

    const compactGuide = await compactMatchupGuideForStorage(guideWithMetadata)
    const writeResult = await FileManager.writeJson(filePath, {
      ...compactGuide,
      id: guideId,
      visibility: 'public' as const,
      fileName,
      savedAt: new Date().toISOString(),
      editSecret: auth.editSecret,
    })
    if (writeResult.isErr()) {
      console.error('[Matchup Guides API] write failed:', writeResult.unwrapErr())
      return res.status(500).json({ error: 'Failed to save matchup guide file' })
    }
    listCache = null

    return res.json({
      id: guideId,
      fileName,
      editSecret: auth.editSecret,
      message: 'Matchup guide saved successfully',
    })
  } catch (error) {
    console.error('[Matchup Guides API] save failed:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/matchup-guides
 * Public guides only (fichiers {uuid}.json — jamais *_priv.json)
 */
router.get('/', async (_req, res) => {
  try {
    if (listCache && Date.now() - listCache.at < LIST_CACHE_TTL_MS) {
      return res.json(listCache.guides)
    }
    await FileManager.ensureDir(guidesDir)
    const files = await fs.readdir(guidesDir)
    const guideFiles = files.filter(file => isValidGuideId(file.replace(/\.json$/i, '')) && /\.json$/i.test(file))

    const resolved = await Promise.all(
      guideFiles.map(async file => {
        const raw = await readStoredGuide(join(guidesDir, file))
        return raw ? resolveMatchupGuideBuild(stripEditSecret(raw)) : null
      })
    )
    const guides = resolved.filter(guide => guide !== null)
    listCache = { at: Date.now(), guides }

    return res.json(guides)
  } catch (error) {
    console.error('[Matchup Guides API] list failed:', error)
    return res.status(500).json({ error: 'Failed to read matchup guides directory' })
  }
})

/**
 * GET /api/matchup-guides/:id
 */
router.get('/:id', async (req, res) => {
  const filePath = resolveGuideFilePath(guidesDir, req.params.id)
  const raw = filePath ? await readStoredGuide(filePath) : null
  if (!raw) {
    return res.status(404).json({ error: 'Matchup guide not found' })
  }
  const resolved = await resolveMatchupGuideBuild(stripEditSecret(raw))
  return res.json(resolved)
})

/**
 * DELETE /api/matchup-guides/:id
 */
router.delete('/:id', guideWriteRateLimit, async (req, res) => {
  try {
    const filePath = resolveGuideFilePath(guidesDir, req.params.id)
    const existing = filePath ? await readStoredGuide(filePath) : null
    if (!filePath || !existing) {
      return res.status(404).json({ error: 'Matchup guide not found' })
    }

    const auth = verifyEditSecret(existing, req.header(BUILD_EDIT_SECRET_HEADER))
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error })
    }

    await fs.unlink(filePath)
    listCache = null
    return res.json({ message: 'Matchup guide deleted successfully' })
  } catch (error) {
    console.error('[Matchup Guides API] delete failed:', error)
    return res.status(500).json({ error: 'Failed to delete matchup guide' })
  }
})

export default router
