import { Router } from 'express'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { FileManager } from '../utils/fileManager.js'
import {
  trackBuildView,
  trackBuildShare,
  getEngagementViewCounts,
  type BuildShareType,
} from '../services/BuildEngagementService.js'

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
const buildsDir = join(process.cwd(), 'data', 'builds')
const VALID_SHARE_TYPES: BuildShareType[] = ['link', 'image', 'image_with_meta']
const BUILD_FILE_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/i

/**
 * Save a build
 * POST /api/builds
 * Body: Build object (frontend Build type)
 *
 * - Les builds publics utilisent un fichier: {uuid}.json
 * - Les builds privés utilisent un fichier: {uuid}_priv.json
 */
router.post('/', async (req, res) => {
  try {
    const build = req.body as BuildPayload & {
      id?: string
      name?: string
      visibility?: 'public' | 'private'
    }
    
    if (!build || typeof build !== 'object') {
      console.error('[Builds API] Invalid payload received')
      return res.status(400).json({ error: 'Invalid build payload' })
    }

    // Use existing ID or generate new one
    const buildId = build.id || randomUUID()
    const isPrivate = build.visibility === 'private'
    const fileName = `${buildId}${isPrivate ? '_priv' : ''}.json`
    const filePath = join(buildsDir, fileName)


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
    const { patchStale: _patchStale, ...buildWithoutPatchStale } = build as BuildPayload & {
      patchStale?: unknown
    }

    // Add metadata (ensure id and basic info are present)
    const buildWithMetadata = {
      ...buildWithoutPatchStale,
      id: buildId,
      fileName,
      savedAt: new Date().toISOString(),
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

    return res.json({ 
      id: buildId,
      fileName,
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
 * Latest public builds by creation date.
 * GET /api/builds/recent?limit=6
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = Math.min(12, Math.max(1, parseInt(String(req.query.limit ?? '6'), 10) || 6))
    const { promises: fs } = await import('fs')
    const files = await fs.readdir(buildsDir)
    const buildFiles = files.filter(file => BUILD_FILE_REGEX.test(file))

    const builds = (
      await Promise.all(
        buildFiles.map(async file => {
          const filePath = join(buildsDir, file)
          const readResult = await FileManager.readJson<
            BuildPayload & { id?: string; createdAt?: string; visibility?: string }
          >(filePath)
          if (readResult.isErr()) return null
          const build = readResult.unwrap()
          if (build.visibility === 'private') return null
          const id = String(build.id ?? file.replace(/\.json$/i, ''))
          return {
            build,
            id,
            createdAt: build.createdAt ?? '',
          }
        })
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null)

    builds.sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )

    res.set('Cache-Control', 'public, max-age=300')
    return res.json({
      totalBuilds: buildFiles.length,
      builds: builds.slice(0, limit).map(row => row.build),
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
    const { promises: fs } = await import('fs')
    const files = await fs.readdir(buildsDir)
    const buildFiles = files.filter(file => BUILD_FILE_REGEX.test(file))
    const viewCounts = await getEngagementViewCounts()

    const builds = (
      await Promise.all(
        buildFiles.map(async file => {
          const filePath = join(buildsDir, file)
          const readResult = await FileManager.readJson<
            BuildPayload & { id?: string; createdAt?: string; visibility?: string }
          >(filePath)
          if (readResult.isErr()) return null
          const build = readResult.unwrap()
          if (build.visibility === 'private') return null
          const id = String(build.id ?? file.replace(/\.json$/i, ''))
          return {
            build,
            id,
            views: viewCounts.get(id) ?? 0,
            createdAt: build.createdAt ?? '',
          }
        })
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null)

    builds.sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })

    res.set('Cache-Control', 'public, max-age=300')
    return res.json({
      totalBuilds: buildFiles.length,
      builds: builds.slice(0, limit).map(row => row.build),
    })
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load popular builds' })
  }
})

/**
 * Get a build by ID
 * GET /api/builds/:id
 */
router.get('/:id', async (req, res) => {
  const buildId = req.params.id

  // Try to find the build file (public ou privé) dans data/builds
  try {
    const { promises: fs } = await import('fs')
    const files = await fs.readdir(buildsDir)
    const buildFile =
      files.find(file => file === `${buildId}.json`) ||
      files.find(file => file === `${buildId}_priv.json`)
    
    if (!buildFile) {
      return res.status(404).json({ error: 'Build not found' })
    }

    const filePath = join(buildsDir, buildFile)
    const readResult = await FileManager.readJson(filePath)
    
    if (readResult.isErr()) {
      if (readResult.unwrapErr().code === 'FILE_NOT_FOUND') {
        return res.status(404).json({ error: 'Build not found' })
      }
      return res.status(500).json({ error: readResult.unwrapErr().message })
    }

    return res.json(readResult.unwrap())
  } catch (error) {
    return res.status(500).json({ error: 'Failed to read builds directory' })
  }
})

/**
 * Track one view on build details page.
 * POST /api/builds/:id/track-view
 */
router.post('/:id/track-view', async (req, res) => {
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
router.post('/:id/track-share', async (req, res) => {
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
 * Get all builds (public only — private builds are never exposed here)
 * GET /api/builds
 */
router.get('/', async (_req, res) => {
  try {
    const { promises: fs } = await import('fs')
    const files = await fs.readdir(buildsDir)
    const buildFiles = files.filter(file => BUILD_FILE_REGEX.test(file))
    
    const builds = await Promise.all(
      buildFiles.map(async (file) => {
        const filePath = join(buildsDir, file)
        const readResult = await FileManager.readJson(filePath)
        if (readResult.isOk()) {
          return readResult.unwrap()
        }
        return null
      })
    )

    return res.json(builds.filter(build => build !== null))
  } catch (error) {
    return res.status(500).json({ error: 'Failed to read builds directory' })
  }
})

/**
 * Delete a build by ID
 * DELETE /api/builds/:id
 */
router.delete('/:id', async (req, res) => {
  const buildId = req.params.id

  try {
    const { promises: fs } = await import('fs')
    const files = await fs.readdir(buildsDir)
    
    // Try to find the build file (public ou privé)
    const buildFile =
      files.find(file => file === `${buildId}.json`) ||
      files.find(file => file === `${buildId}_priv.json`)
    
    if (!buildFile) {
      return res.status(404).json({ error: 'Build not found' })
    }

    const filePath = join(buildsDir, buildFile)
    
    // Delete the file
    try {
      await fs.unlink(filePath)
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
