import { Router } from 'express'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { promises as fs } from 'fs'
import { FileManager } from '../utils/fileManager.js'

const router = Router()
const sharedDir = join(process.cwd(), 'data', 'shared')
const privateTempDir = join(process.cwd(), 'data', 'private-temp')
const buildsDir = join(process.cwd(), 'data', 'builds')

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
              const code = file.replace(/\.json$/, '')
              const privDir = join(privateTempDir, code)
              const privFiles = await fs.readdir(privDir).catch(() => [] as string[])
              for (const f of privFiles) {
                await fs.unlink(join(privDir, f)).catch(() => {})
              }
              await fs.rmdir(privDir).catch(() => {})
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

    // Store private builds in private-temp for this code (isolated from public builds)
    const privateBuilds = builds.filter(
      (b): b is { id?: string; visibility?: string } & object =>
        Boolean(b && typeof b === 'object' && (b as { visibility?: string }).visibility === 'private')
    )
    for (const b of privateBuilds) {
      if (b?.id) {
        const privPath = join(privateTempDir, code, `${b.id}.json`)
        await FileManager.writeJson(privPath, b).catch(() => {})
      }
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
      await fs.unlink(filePath).catch(() => {})
      return res.status(404).json({ error: 'Code not found or expired' })
    }

    const builds = data.builds as Array<{ id?: string; visibility?: string }>

    // One-time use: delete shared file first (source of truth for this code)
    await fs.unlink(filePath)
    console.log(`[Share] Code ${code} consumed and deleted`)

    // Delete private builds from private-temp (if any were stored there)
    try {
      const privDir = join(privateTempDir, code)
      const privFiles = await fs.readdir(privDir).catch(() => [] as string[])
      for (const f of privFiles) {
        if (f.endsWith('.json')) {
          await fs.unlink(join(privDir, f)).catch(() => {})
        }
      }
      await fs.rmdir(privDir).catch(() => {})
    } catch {
      // private-temp/{code} may not exist
    }

    // Cleanup legacy: delete any _priv.json from builds dir (old sync may have left them)
    for (const b of builds) {
      if (b?.id && b.visibility === 'private') {
        const privFile = join(buildsDir, `${b.id}_priv.json`)
        await fs.unlink(privFile).catch(() => {})
      }
    }

    cleanupExpired()

    return res.json({ builds: data.builds, expiresAt: data.expiresAt })
  } catch (error) {
    console.error('[Share] Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
