import { Router } from 'express'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { FileManager } from '../utils/fileManager.js'

type SharedBuildPayload = unknown

type StoredSharedBuild = {
  shareId: string
  createdAt: string
  build: SharedBuildPayload
}

const router = Router()
const sharedBuildsDir = join(process.cwd(), 'data', 'shared-builds')

/**
 * Create a shared build (public, no auth)
 * POST /api/shared-builds
 * Body: any JSON build object (frontend Build type)
 */
router.post('/', async (req, res) => {
  const build = req.body as SharedBuildPayload
  if (!build || typeof build !== 'object') {
    return res.status(400).json({ error: 'Invalid build payload' })
  }

  const shareId = randomUUID()
  const createdAt = new Date().toISOString()
  const filePath = join(sharedBuildsDir, `${shareId}.json`)

  const writeResult = await FileManager.writeJson<StoredSharedBuild>(filePath, {
    shareId,
    createdAt,
    build
  })

  if (writeResult.isErr()) {
    return res.status(500).json({ error: writeResult.unwrapErr().message })
  }

  return res.json({ shareId })
})

/**
 * Get a shared build by shareId (public, no auth)
 * GET /api/shared-builds/:shareId
 */
router.get('/:shareId', async (req, res) => {
  const shareId = req.params.shareId
  const filePath = join(sharedBuildsDir, `${shareId}.json`)

  const readResult = await FileManager.readJson<StoredSharedBuild>(filePath)
  if (readResult.isErr()) {
    if (readResult.unwrapErr().code === 'FILE_NOT_FOUND') {
      return res.status(404).json({ error: 'Shared build not found' })
    }
    return res.status(500).json({ error: readResult.unwrapErr().message })
  }

  return res.json(readResult.unwrap())
})

export default router

