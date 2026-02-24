import express from 'express'
import { join } from 'path'
import { promises as fs } from 'fs'
import { FileManager } from '../utils/fileManager.js'

const router = express.Router()
const imagesDir = join(process.cwd(), 'data', 'images')

/**
 * Serve images from local storage
 * GET /api/images/:version/:type/{*filename} (reste du chemin = filename)
 * Examples:
 *   /api/images/latest/champion/Aatrox.png
 *   /api/images/latest/item/1001.png
 *   /api/images/latest/spell/SummonerFlash.png
 *   /api/images/latest/rune/paths/8000.png
 *   /api/images/latest/rune/runes/8005.png
 *   /api/images/latest/champion-spell/Aatrox/AatroxQ.png
 *
 * Note: :version is accepted for backward compatibility, but files are always
 * served from data/images/latest.
 *
 * Avec Express 5 / path-to-regexp v8, les wildcards anonymes (`*`) ne sont
 * plus supportés. Il faut utiliser un paramètre nommé avec la syntaxe
 * `{*nom}`. Ici : `{*filename}`.
 */
router.get('/:version/:type/{*filename}', async (req, res) => {
  try {
    const { type } = req.params
    // Avec la syntaxe `{*filename}`, Express expose `req.params.filename`
    // qui peut être un string ou un tableau de segments.
    const rawFilename = (req.params as any).filename as string | string[] | undefined
    const filename =
      Array.isArray(rawFilename) ? rawFilename.join('/') : rawFilename || ''

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
    // Images are stored in latest-only structure. `:version` is kept for backward compatibility.
    const filePath = join(imagesDir, 'latest', type, filename)

    // Security: ensure path is within imagesDir
    const normalizedPath = join(imagesDir, 'latest', type, filename)
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
    // latest path changes over time: avoid immutable cache.
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(fileBuffer)
    return
  } catch (error) {
    console.error('[Images] Error serving image:', error)
    res.status(500).json({ error: 'Failed to serve image' })
    return
  }
})

export default router
