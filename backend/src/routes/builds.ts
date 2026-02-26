import { Router } from 'express'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { FileManager } from '../utils/fileManager.js'

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

    console.log(`[Builds API] Saving build: ${fileName} to ${buildsDir}`)

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

    // Add metadata (ensure id and basic info are present)
    const buildWithMetadata = {
      ...build,
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

    console.log(`[Builds API] Build saved successfully: ${fileName}`)
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
 * Get all builds (public only — private builds are never exposed here)
 * GET /api/builds
 */
router.get('/', async (_req, res) => {
  try {
    const { promises: fs } = await import('fs')
    const files = await fs.readdir(buildsDir)
    const buildFiles = files.filter(
      file => file.endsWith('.json') && !file.endsWith('_priv.json')
    )
    
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
      console.log(`[Builds API] Build deleted successfully: ${buildFile}`)
      return res.json({ 
        id: buildId,
        message: 'Build deleted successfully'
      })
    } catch (unlinkError) {
      console.error(`[Builds API] Failed to delete build file: ${unlinkError}`)
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
