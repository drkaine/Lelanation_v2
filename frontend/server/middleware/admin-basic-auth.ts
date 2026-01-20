import { defineEventHandler, getHeader, setHeader, createError } from 'h3'

function decodeBasicAuth(authHeader: string): { username: string; password: string } | null {
  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Basic' || !token) return null

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const idx = decoded.indexOf(':')
    if (idx === -1) return null
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) }
  } catch {
    return null
  }
}

export default defineEventHandler(event => {
  const cfg = useRuntimeConfig(event)
  const username = cfg.admin?.username as string | undefined
  const password = cfg.admin?.password as string | undefined
  const pathPrefix = (cfg.admin?.pathPrefix as string | undefined) || '/admin'

  if (!event.path.startsWith(pathPrefix)) return

  // If credentials are not configured, don't block (dev convenience).
  if (!username || !password) return

  const auth = getHeader(event, 'authorization')
  if (!auth) {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Admin"')
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const decoded = decodeBasicAuth(auth)
  if (!decoded || decoded.username !== username || decoded.password !== password) {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Admin"')
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }
})
