import express from 'express'
import { join, resolve, sep } from 'path'

const router = express.Router()
const imagesDir = join(process.cwd(), 'data', 'images')
/** Resolved root for path-traversal checks (must compare resolved paths). */
const imagesDirResolved = resolve(imagesDir)
const IMAGE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

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
    const resolvedPath = resolve(filePath)

    // Security: prevent path traversal (e.g. filename = '../../etc/passwd'); compare resolved paths
    if (resolvedPath !== imagesDirResolved && !resolvedPath.startsWith(imagesDirResolved + sep)) {
      return res.status(403).json({ error: 'Invalid path' })
    }

    // sendFile streams the file and handles ETag / Last-Modified / Range (304 instead of a re-download).
    res.sendFile(resolvedPath, { maxAge: IMAGE_MAX_AGE_MS, dotfiles: 'deny' }, err => {
      if (!err || res.headersSent) return
      const status = (err as { status?: number; statusCode?: number }).status ?? (err as { statusCode?: number }).statusCode
      if (status === 404 || (err as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({ error: 'Image not found' })
        return
      }
      console.error('[Images] Error serving image:', err)
      res.status(500).json({ error: 'Failed to serve image' })
    })
    return
  } catch (error) {
    console.error('[Images] Error serving image:', error)
    res.status(500).json({ error: 'Failed to serve image' })
    return
  }
})

export default router
