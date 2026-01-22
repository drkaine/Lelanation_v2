import express from 'express'
import { join } from 'path'
import { promises as fs } from 'fs'
import { FileManager } from '../utils/fileManager.js'

const router = express.Router()
const imagesDir = join(process.cwd(), 'data', 'images')

/**
 * Serve images from local storage
 * GET /api/images/:version/:type/:filename(*)
 * Examples:
 *   /api/images/16.1.1/champion/Aatrox.png
 *   /api/images/16.1.1/item/1001.png
 *   /api/images/16.1.1/spell/SummonerFlash.png
 *   /api/images/16.1.1/rune/paths/8000.png
 *   /api/images/16.1.1/rune/runes/8005.png
 *   /api/images/16.1.1/champion-spell/Aatrox/AatroxQ.png
 */
router.get('/:version/:type/*', async (req, res) => {
  try {
    const { version, type } = req.params
    // Get the wildcard path (everything after /type/)
    // Express stores wildcard matches in req.params[0] but TypeScript doesn't know about it
    const filename = (req.params as any)[0] || ''

    // Validate type
    const validTypes = ['champion', 'item', 'spell', 'rune', 'champion-spell']
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: 'Invalid image type' })
      return
    }

    if (!filename) {
      res.status(400).json({ error: 'Filename is required' })
      return
    }

    // Construct file path (filename can include subdirectories like 'paths/' or 'runes/')
    const filePath = join(imagesDir, version, type, filename)

    // Security: ensure path is within imagesDir
    const normalizedPath = join(imagesDir, version, type, filename)
    if (!normalizedPath.startsWith(imagesDir)) {
      return res.status(403).json({ error: 'Invalid path' })
    }

    // Check if file exists
    const exists = await FileManager.exists(filePath)
    if (!exists) {
      return res.status(404).json({ error: 'Image not found' })
    }

    // Read and serve file
    const fileBuffer = await fs.readFile(filePath)

    // Set appropriate content type
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentType =
      ext === 'png'
        ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'gif'
            ? 'image/gif'
            : ext === 'webp'
              ? 'image/webp'
              : 'application/octet-stream'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(fileBuffer)
    return
  } catch (error) {
    console.error('[Images] Error serving image:', error)
    res.status(500).json({ error: 'Failed to serve image' })
    return
  }
})

export default router
