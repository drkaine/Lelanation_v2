import { Router } from 'express'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import { FileManager } from '../utils/fileManager.js'

const router = Router()
const sharedDir = join(process.cwd(), 'data', 'shared')

const CODE_LENGTH = 6
const TTL_MS = 24 * 60 * 60 * 1000
const MAX_BUILDS = 50
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  return Array.from(bytes)
    .map(b => ALPHABET[b % ALPHABET.length])
    .join('')
}

async function cleanupExpired(): Promise<void> {
  try {
    const files = await fs.readdir(sharedDir)
    const now = Date.now()
    await Promise.allSettled(
      files
        .filter(f => f.endsWith('.json'))
        .map(async file => {
          const filePath = join(sharedDir, file)
          const result = await FileManager.readJson<{ expiresAt: string }>(filePath)
          if (result.isOk()) {
            const data = result.unwrap()
            if (new Date(data.expiresAt).getTime() < now) {
              await fs.unlink(filePath)
            }
          }
        })
    )
  } catch {
    // Directory may not exist yet
  }
}

/**
 * POST /api/share-builds
 * Body: { builds: StoredBuild[] }
 * Returns: { code, expiresAt }
 */
router.post('/', async (req, res) => {
  try {
    const { builds } = req.body as { builds?: unknown[] }

    if (!Array.isArray(builds) || builds.length === 0) {
      return res.status(400).json({ error: 'Body must contain a non-empty "builds" array' })
    }
    if (builds.length > MAX_BUILDS) {
      return res.status(400).json({ error: `Maximum ${MAX_BUILDS} builds allowed` })
    }

    const dirResult = await FileManager.ensureDir(sharedDir)
    if (dirResult.isErr()) {
      return res.status(500).json({ error: 'Failed to create shared directory' })
    }

    // Generate unique code (retry on collision)
    let code = generateCode()
    let attempts = 0
    while (await FileManager.exists(join(sharedDir, `${code}.json`)) && attempts < 5) {
      code = generateCode()
      attempts++
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + TTL_MS).toISOString()

    const payload = {
      code,
      builds,
      createdAt: now.toISOString(),
      expiresAt,
    }

    const filePath = join(sharedDir, `${code}.json`)
    const writeResult = await FileManager.writeJson(filePath, payload)
    if (writeResult.isErr()) {
      return res.status(500).json({ error: 'Failed to save shared builds' })
    }

    console.log(`[Share] Created share code ${code} with ${builds.length} builds (expires ${expiresAt})`)

    // Lazy cleanup in background
    cleanupExpired()

    return res.json({ code, expiresAt })
  } catch (error) {
    console.error('[Share] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /api/share-builds/:code
 * Returns: { builds, expiresAt }
 */
router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim()

    if (!/^[A-Z0-9]{4,10}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid code format' })
    }

    const filePath = join(sharedDir, `${code}.json`)
    const readResult = await FileManager.readJson<{
      builds: unknown[]
      expiresAt: string
    }>(filePath)

    if (readResult.isErr()) {
      return res.status(404).json({ error: 'Code not found or expired' })
    }

    const data = readResult.unwrap()
    if (new Date(data.expiresAt).getTime() < Date.now()) {
      fs.unlink(filePath).catch(() => {})
      return res.status(404).json({ error: 'Code not found or expired' })
    }

    // One-time use: delete after retrieval
    fs.unlink(filePath).catch(() => {})
    console.log(`[Share] Code ${code} consumed and deleted`)

    // Lazy cleanup of other expired codes
    cleanupExpired()

    return res.json({ builds: data.builds, expiresAt: data.expiresAt })
  } catch (error) {
    console.error('[Share] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
