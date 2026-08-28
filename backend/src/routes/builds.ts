import { Router } from 'express'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { FileManager } from '../utils/fileManager.js'
import {
  BUILD_EDIT_SECRET_HEADER,
  isValidBuildUuid,
  resolveBuildFilePath,
  stripEditSecret,
  verifyEditSecret,
} from '../utils/buildEditAuth.js'
import {
  trackBuildView,
  trackBuildShare,
  trackBuildAppImport,
  trackBuildFavorite,
  getEngagementViewCounts,
  removeBuildEngagement,
  type BuildShareType,
  type BuildFavoriteAction,
} from '../services/BuildEngagementService.js'
import {
  castBuildVote,
  getBuildVoteStatsBatch,
  syncBuildVotesForVoter,
  type BuildVoteDirection,
} from '../services/BuildVoteService.js'
import { buildsDir, getBuildIndex, invalidateBuildIndex, getBuildActivityTime } from '../services/BuildIndexService.js'
import { createRateLimit } from '../utils/httpRateLimit.js'

const buildWriteRateLimit = createRateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'builds-write' })
const buildEngagementRateLimit = createRateLimit({
  windowMs: 60_000,
  max: 120,
  keyPrefix: 'builds-engage',
})

const VOTER_ID_HEADER = 'x-voter-id'

function readVoterId(req: { header: (name: string) => string | undefined }): string | null {
  const raw = req.header(VOTER_ID_HEADER)?.trim()
  if (!raw || raw.length > 128) return null
  return raw
}

type BuildPayload = unknown

const router = Router()

// Stockage des builds côté backend, en fichiers JSON:
//   backend/data/builds/{uuid}.json        (public)
//   backend/data/builds/{uuid}_priv.json  (privé)
//
// Ils sont exposés via l'API (`/api/builds`), ce qui évite
// les problèmes de droits / chemins vers le dossier frontend
// sur le serveur de prod. Si besoin, un script pourra plus tard
// recopier ces fichiers vers le front pour un mode 100% statique.
// `buildsDir` est centralisé dans BuildIndexService (source unique + testable).
const VALID_SHARE_TYPES: BuildShareType[] = ['link', 'image', 'image_with_meta']

async function loadExistingBuild(
  buildId: string
): Promise<{ filePath: string; data: Record<string, unknown> } | null> {
  for (const isPrivate of [false, true]) {
    const filePath = resolveBuildFilePath(buildId, isPrivate)
    if (!filePath) continue
    const readResult = await FileManager.readJson<Record<string, unknown>>(filePath)
    if (readResult.isOk()) {
      return { filePath, data: readResult.unwrap() }
    }
  }
  return null
}

/**
 * Save a build
 * POST /api/builds
 * Body: Build object (frontend Build type)
 *
 * - Les builds publics utilisent un fichier: {uuid}.json
 * - Les builds privés utilisent un fichier: {uuid}_priv.json
 */
router.post('/', buildWriteRateLimit, async (req, res) => {
  try {
    const build = req.body as BuildPayload & {
      id?: string
      name?: string
      visibility?: 'public' | 'private'
      editSecret?: unknown
    }
    
    if (!build || typeof build !== 'object') {
      console.error('[Builds API] Invalid payload received')
      return res.status(400).json({ error: 'Invalid build payload' })
    }

    const requestedId = typeof build.id === 'string' ? build.id.trim() : ''
    const buildId = requestedId || randomUUID()
    if (!isValidBuildUuid(buildId)) {
      return res.status(400).json({ error: 'Invalid build id (expected UUID)' })
    }

    const isPrivate = build.visibility === 'private'
    const filePath = resolveBuildFilePath(buildId, isPrivate)
    if (!filePath) {
      return res.status(400).json({ error: 'Invalid build path' })
    }

    const existing = await loadExistingBuild(buildId)
    const auth = verifyEditSecret(existing?.data ?? null, req.header(BUILD_EDIT_SECRET_HEADER))
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error })
    }

    // Ensure builds directory exists
    const dirResult = await FileManager.ensureDir(buildsDir)
    if (dirResult.isErr()) {
      const err = dirResult.unwrapErr()
      console.error(`[Builds API] Failed to create builds directory: ${err.message}`)
      return res.status(500).json({ 
        error: 'Failed to create builds directory',
        details: err.message 
      })
    }

    // Saving a build clears patch stale flag (author reviewed / updated the build).
    const { patchStale: _patchStale, editSecret: _editSecret, ...buildWithoutSensitive } = build as BuildPayload & {
      patchStale?: unknown
      editSecret?: unknown
    }

    const fileName = `${buildId}${isPrivate ? '_priv' : ''}.json`

    // Add metadata (ensure id and basic info are present)
    const buildWithMetadata = {
      ...buildWithoutSensitive,
      id: buildId,
      fileName,
      savedAt: new Date().toISOString(),
      editSecret: auth.editSecret,
    }

    const writeResult = await FileManager.writeJson(filePath, buildWithMetadata)

    if (writeResult.isErr()) {
      const err = writeResult.unwrapErr()
      console.error(`[Builds API] Failed to write build file: ${err.message}`)
      return res.status(500).json({ 
        error: 'Failed to save build file',
        details: err.message 
      })
    }

    if (existing && existing.filePath !== filePath) {
      await fs.unlink(existing.filePath).catch(() => undefined)
    }

    invalidateBuildIndex()

    return res.json({ 
      id: buildId,
      fileName,
      editSecret: auth.editSecret,
      message: 'Build saved successfully'
    })
  } catch (error) {
    console.error('[Builds API] Unexpected error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

/**
 * Latest public builds by creation or update date.
 * GET /api/builds/recent?limit=6
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(12, Math.max(1, parseInt(String(req.query.limit ?? '6'), 10) || 6))
    const { entries, fileCount } = await getBuildIndex()

    const builds = entries
      .filter(entry => entry.visibility !== 'private')
      .sort((a, b) => getBuildActivityTime(b.build) - getBuildActivityTime(a.build))

    res.set('Cache-Control', 'public, max-age=300')
    return res.json({
      totalBuilds: fileCount,
      builds: builds.slice(0, limit).map(entry => entry.build),
    })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load recent builds' })
  }
})

/**
 * Top public builds by engagement views (fallback: most recent).
 * GET /api/builds/popular?limit=6
 */
router.get('/popular', async (req, res) => {
  try {
    const limit = Math.min(12, Math.max(1, parseInt(String(req.query.limit ?? '6'), 10) || 6))
    const [{ entries, fileCount }, viewCounts] = await Promise.all([
      getBuildIndex(),
      getEngagementViewCounts(),
    ])

    const builds = entries
      .filter(entry => entry.visibility !== 'private')
      .map(entry => ({ ...entry, views: viewCounts.get(entry.id) ?? 0 }))
      .sort((a, b) => {
        if (b.views !== a.views) return b.views - a.views
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      })

    res.set('Cache-Control', 'public, max-age=300')
    return res.json({
      totalBuilds: fileCount,
      builds: builds.slice(0, limit).map(row => row.build),
    })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load popular builds' })
  }
})

/**
 * Batch vote stats for public builds.
 * GET /api/builds/votes?ids=uuid1,uuid2
 */
router.get('/votes', async (req, res) => {
  try {
    const raw = typeof req.query.ids === 'string' ? req.query.ids : ''
    const buildIds = raw
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .slice(0, 200)
    const voterId = readVoterId(req)
    const stats = await getBuildVoteStatsBatch(buildIds, voterId)
    res.set('Cache-Control', 'public, max-age=30')
    return res.json({ votes: stats })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load build votes',
    })
  }
})

/**
 * Idempotent sync of legacy browser votes (one voter, many builds).
 * POST /api/builds/votes/sync
 * Body: { votes: { [buildId]: "up" | "down" } }
 */
router.post('/votes/sync', buildEngagementRateLimit, async (req, res) => {
  const voterId = readVoterId(req)
  if (!voterId) return res.status(400).json({ error: 'Missing X-Voter-Id header' })

  const rawVotes = req.body?.votes
  if (!rawVotes || typeof rawVotes !== 'object' || Array.isArray(rawVotes)) {
    return res.status(400).json({ error: 'Invalid votes payload' })
  }

  const votes: Record<string, BuildVoteDirection> = {}
  for (const [buildId, direction] of Object.entries(rawVotes as Record<string, unknown>)) {
    const id = buildId.trim()
    if (!id) continue
    if (direction === 'up' || direction === 'down') votes[id] = direction
  }

  if (Object.keys(votes).length === 0) {
    return res.json({ ok: true, votes: {}, autoPrivatizedBuildIds: [] })
  }

  try {
    const result = await syncBuildVotesForVoter(voterId, votes)
    return res.json({ ok: true, ...result })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to sync build votes',
    })
  }
})

/**
 * Get a build by ID
 * GET /api/builds/:id
 */
router.get('/:id', async (req, res) => {
  const buildId = req.params.id.trim()
  if (!isValidBuildUuid(buildId)) {
    return res.status(400).json({ error: 'Invalid build id (expected UUID)' })
  }

  try {
    const existing = await loadExistingBuild(buildId)
    if (!existing) {
      return res.status(404).json({ error: 'Build not found' })
    }

    const readResult = await FileManager.readJson(existing.filePath)
    
    if (readResult.isErr()) {
      if (readResult.unwrapErr().code === 'FILE_NOT_FOUND') {
        return res.status(404).json({ error: 'Build not found' })
      }
      return res.status(500).json({ error: readResult.unwrapErr().message })
    }

    return res.json(stripEditSecret(readResult.unwrap() as Record<string, unknown>))
  } catch (error) {
    return res.status(500).json({ error: 'Failed to read builds directory' })
  }
})

/**
 * Toggle up/down vote on a build (shared across users).
 * POST /api/builds/:id/vote
 * Body: { direction: 'up' | 'down' }
 * Header: X-Voter-Id (anonymous voter id from browser localStorage)
 */
router.post('/:id/vote', buildEngagementRateLimit, async (req, res) => {
  const buildId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  const directionRaw = typeof req.body?.direction === 'string' ? req.body.direction.trim() : ''
  const voterId = readVoterId(req)

  if (!buildId) return res.status(400).json({ error: 'Invalid build id' })
  if (!voterId) return res.status(400).json({ error: 'Missing X-Voter-Id header' })
  if (directionRaw !== 'up' && directionRaw !== 'down') {
    return res.status(400).json({ error: 'Invalid direction (expected up or down)' })
  }

  const direction = directionRaw as BuildVoteDirection
  try {
    const { stats, autoPrivatized } = await castBuildVote(buildId, voterId, direction)
    return res.json({ ok: true, stats, autoPrivatized })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to cast build vote',
    })
  }
})

/**
 * Track one view on build details page.
 * POST /api/builds/:id/track-view
 */
router.post('/:id/track-view', buildEngagementRateLimit, async (req, res) => {
  const buildId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  if (!buildId) return res.status(400).json({ error: 'Invalid build id' })
  try {
    const stats = await trackBuildView(buildId)
    return res.json({ ok: true, stats })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to track build view',
    })
  }
})

/**
 * Track one share action by type.
 * POST /api/builds/:id/track-share
 * Body: { shareType: 'link' | 'image' | 'image_with_meta' }
 */
router.post('/:id/track-share', buildEngagementRateLimit, async (req, res) => {
  const buildId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  const shareTypeRaw = typeof req.body?.shareType === 'string' ? req.body.shareType.trim() : ''
  if (!buildId) return res.status(400).json({ error: 'Invalid build id' })
  if (!VALID_SHARE_TYPES.includes(shareTypeRaw as BuildShareType)) {
    return res.status(400).json({ error: 'Invalid shareType' })
  }
  const shareType = shareTypeRaw as BuildShareType
  try {
    const stats = await trackBuildShare(buildId, shareType)
    return res.json({ ok: true, stats })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to track build share',
    })
  }
})

/**
 * Track one companion app import into the LoL client.
 * POST /api/builds/:id/track-import
 */
router.post('/:id/track-import', buildEngagementRateLimit, async (req, res) => {
  const buildId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  if (!buildId) return res.status(400).json({ error: 'Invalid build id' })
  try {
    const stats = await trackBuildAppImport(buildId)
    return res.json({ ok: true, stats })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to track build import',
    })
  }
})

/**
 * Track favorite add/remove.
 * POST /api/builds/:id/track-favorite
 * Body: { action: 'add' | 'remove' }
 */
router.post('/:id/track-favorite', buildEngagementRateLimit, async (req, res) => {
  const buildId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  const actionRaw = typeof req.body?.action === 'string' ? req.body.action.trim() : ''
  if (!buildId) return res.status(400).json({ error: 'Invalid build id' })
  if (actionRaw !== 'add' && actionRaw !== 'remove') {
    return res.status(400).json({ error: 'Invalid action' })
  }
  const action = actionRaw as BuildFavoriteAction
  try {
    const stats = await trackBuildFavorite(buildId, action)
    return res.json({ ok: true, stats })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to track build favorite',
    })
  }
})

/**
 * Get all builds (public only — private builds are never exposed here)
 * GET /api/builds
 */
router.get('/', async (_req, res) => {
  try {
    const { entries } = await getBuildIndex()
    return res.json(entries.map(entry => entry.build))
  } catch (error) {
    return res.status(500).json({ error: 'Failed to read builds directory' })
  }
})

/**
 * Delete a build by ID
 * DELETE /api/builds/:id
 */
router.delete('/:id', buildWriteRateLimit, async (req, res) => {
  const buildId = typeof req.params.id === 'string' ? req.params.id.trim() : ''
  if (!isValidBuildUuid(buildId)) {
    return res.status(400).json({ error: 'Invalid build id (expected UUID)' })
  }

  try {
    const existing = await loadExistingBuild(buildId)
    if (!existing) {
      return res.status(404).json({ error: 'Build not found' })
    }

    const auth = verifyEditSecret(existing.data, req.header(BUILD_EDIT_SECRET_HEADER))
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error })
    }

    try {
      await fs.unlink(existing.filePath)
      invalidateBuildIndex()
      await removeBuildEngagement(buildId).catch(() => undefined)
      return res.json({
        id: buildId,
        message: 'Build deleted successfully'
      })
    } catch (unlinkError) {
      return res.status(500).json({ 
        error: 'Failed to delete build file',
        details: unlinkError instanceof Error ? unlinkError.message : 'Unknown error'
      })
    }
  } catch (error) {
    console.error('[Builds API] Unexpected error:', error)
    return res.status(500).json({ 
      error: 'Failed to read builds directory',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router
