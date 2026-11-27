import { readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createError } from 'h3'
import { imageCacheControl, imageCandidates } from '../../../../utils/imageVariant'

const EXT_TO_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export default defineEventHandler(async event => {
  const pathParam = getRouterParam(event, 'path')
  const pathSegments = pathParam ? pathParam.split('/').filter(Boolean) : []
  if (pathSegments.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const publicDir =
    process.env.NODE_ENV === 'production'
      ? join(process.cwd(), '.output', 'public')
      : join(process.cwd(), 'public')
  const base = join(publicDir, 'images', 'game')
  const requestedPath = join(base, ...pathSegments)
  // Trailing separator: `images/game-other/…` must not pass the prefix check.
  if (!requestedPath.startsWith(base + sep)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  try {
    const ext = requestedPath.slice(requestedPath.lastIndexOf('.'))
    const contentType = EXT_TO_TYPE[ext] ?? 'application/octet-stream'
    const candidates = imageCandidates(requestedPath, getRequestHeader(event, 'accept'))
    let buf: Buffer | null = null
    let servedType = contentType
    for (const file of candidates) {
      try {
        buf = await readFile(file)
        servedType = file.endsWith('.webp') && file !== requestedPath ? 'image/webp' : contentType
        break
      } catch (err: unknown) {
        if (file === requestedPath) throw err
      }
    }
    if (!buf) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    setHeader(event, 'Content-Type', servedType)
    setHeader(event, 'Vary', 'Accept')
    setHeader(event, 'Cache-Control', imageCacheControl(typeof getQuery(event).v === 'string'))
    return buf
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : null
    if (code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }
    throw err
  }
})
