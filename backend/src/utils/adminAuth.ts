import { createHash, timingSafeEqual } from 'crypto'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { readBearerToken, resolveUser } from '../routes/userAuth.js'
import { isDevelopmentEnv } from './env.js'
import { createFailureLimiter } from './httpRateLimit.js'

function parseBasicAuth(authHeader: string): { username: string; password: string } | null {
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

/** Constant-time string comparison (hashing first so lengths never leak). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// 10 bad credentials in 15 minutes from one IP => locked out for the rest of the window.
const adminAuthFailures = createFailureLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  keyPrefix: 'admin-auth-fail',
})

/** Session of a user with the admin role (Bearer token from /api/users/login). */
async function adminSession(req: Request, res: Response, next: NextFunction) {
  if (!readBearerToken(req)) return next()
  try {
    const user = await resolveUser(req)
    if (!user) return res.status(401).json({ error: 'Invalid session' })
    if (user.role !== 'admin') return res.status(403).json({ error: 'Admin role required' })
    res.locals.adminSession = true
    return next()
  } catch (err) {
    console.error('[admin] session lookup failed', err)
    return res.status(500).json({ error: 'Session lookup failed' })
  }
}

/** Basic auth for admin API (supports ADMIN_USER_NAME or ADMIN_USERNAME). */
function adminBasicAuth(req: Request, res: Response, next: NextFunction) {
  if (res.locals.adminSession === true) return next()
  const user = process.env.ADMIN_USER_NAME || process.env.ADMIN_USERNAME
  const pass = process.env.ADMIN_PASSWORD
  if (!user || !pass) {
    if (isDevelopmentEnv()) return next()
    return res.status(503).json({ error: 'Admin API disabled: credentials not configured' })
  }

  const blockedFor = adminAuthFailures.blockedFor(req)
  if (blockedFor > 0) {
    res.setHeader('Retry-After', String(blockedFor))
    return res.status(429).json({ error: 'Too many failed attempts' })
  }

  const header = req.header('authorization')
  if (!header) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"')
    return res.status(401).json({ error: 'Authentication required' })
  }
  const parsed = parseBasicAuth(header)
  // Evaluate both comparisons so timing does not reveal which field was wrong.
  const userOk = parsed ? safeEqual(parsed.username, user) : false
  const passOk = parsed ? safeEqual(parsed.password, pass) : false
  if (!parsed || !userOk || !passOk) {
    adminAuthFailures.recordFailure(req)
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"')
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  adminAuthFailures.reset(req)
  return next()
}

/** Admin gate: admin session (Bearer) or admin Basic credentials. Use as `router.use(...requireAdmin)`. */
export const requireAdmin: RequestHandler[] = [adminSession, adminBasicAuth]
