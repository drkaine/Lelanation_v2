import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createError } from 'h3'

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
  if (!requestedPath.startsWith(base)) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request' })
  }

  try {
    const buf = await readFile(requestedPath)
    const ext = requestedPath.slice(requestedPath.lastIndexOf('.'))
    const contentType = EXT_TO_TYPE[ext] ?? 'application/octet-stream'
    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=3600')
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
