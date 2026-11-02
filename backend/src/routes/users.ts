import { Router } from 'express'
import { createFailureLimiter, createRateLimit } from '../utils/httpRateLimit.js'
import { invitableRoles, isUserRole } from '../services/users/userRoles.js'
import { currentUser, getUserAuthService, readBearerToken, requireUser } from './userAuth.js'

const router = Router()

const authFailures = createFailureLimiter({ windowMs: 15 * 60_000, max: 10, keyPrefix: 'user-auth-fail' })
const registerRateLimit = createRateLimit({ windowMs: 15 * 60_000, max: 20, keyPrefix: 'user-register' })

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

router.post('/login', async (req, res) => {
  const blockedFor = authFailures.blockedFor(req)
  if (blockedFor > 0) {
    res.setHeader('Retry-After', String(blockedFor))
    return res.status(429).json({ error: 'Too many failed attempts' })
  }
  try {
    const result = await getUserAuthService().login(str(req.body?.username), str(req.body?.password))
    if (!result.ok) {
      authFailures.recordFailure(req)
      return res.status(401).json({ error: result.error })
    }
    authFailures.reset(req)
    return res.json({ token: result.token, user: result.user })
  } catch (err) {
    console.error('[users] login failed', err)
    return res.status(500).json({ error: 'Login failed' })
  }
})

router.post('/register', registerRateLimit, async (req, res) => {
  const blockedFor = authFailures.blockedFor(req)
  if (blockedFor > 0) {
    res.setHeader('Retry-After', String(blockedFor))
    return res.status(429).json({ error: 'Too many failed attempts' })
  }
  try {
    const result = await getUserAuthService().register({
      code: str(req.body?.code),
      username: str(req.body?.username),
      password: str(req.body?.password),
    })
    if (!result.ok) {
      if (result.error === 'INVALID_CODE') authFailures.recordFailure(req)
      return res.status(result.error === 'USERNAME_TAKEN' ? 409 : 400).json({ error: result.error })
    }
    return res.status(201).json({ token: result.token, user: result.user })
  } catch (err) {
    console.error('[users] register failed', err)
    return res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/logout', async (req, res) => {
  const token = readBearerToken(req)
  if (token) await getUserAuthService().logout(token).catch(() => undefined)
  return res.json({ ok: true })
})

router.get('/me', requireUser, (_req, res) => {
  const user = currentUser(res)
  return res.json({ user, invitableRoles: invitableRoles(user.role) })
})

router.get('/invitations', requireUser, async (_req, res) => {
  const invitations = await getUserAuthService().listInvitations(currentUser(res))
  return res.json({ invitations })
})

router.post('/invitations', requireUser, async (req, res) => {
  const role = req.body?.role
  if (!isUserRole(role)) return res.status(400).json({ error: 'Invalid role' })
  const result = await getUserAuthService().createInvitation(currentUser(res), role)
  if (!result.ok) return res.status(403).json({ error: result.error })
  return res.status(201).json({ invitation: result.invitation })
})

router.delete('/invitations/:code', requireUser, async (req, res) => {
  const ok = await getUserAuthService().revokeInvitation(currentUser(res), str(req.params.code))
  return ok ? res.json({ ok: true }) : res.status(404).json({ error: 'Invitation not found' })
})

const STATUS = { OK: 200, FORBIDDEN: 403, SELF: 400, NOT_FOUND: 404 } as const

router.get('/', requireUser, async (_req, res) => {
  const users = await getUserAuthService().listUsers(currentUser(res))
  return users ? res.json({ users }) : res.status(403).json({ error: 'FORBIDDEN' })
})

router.patch('/:id', requireUser, async (req, res) => {
  const role = req.body?.role
  if (!isUserRole(role)) return res.status(400).json({ error: 'Invalid role' })
  const result = await getUserAuthService().setRole(currentUser(res), Number(req.params.id), role)
  return res.status(STATUS[result]).json(result === 'OK' ? { ok: true } : { error: result })
})

router.delete('/:id', requireUser, async (req, res) => {
  const result = await getUserAuthService().deleteUser(currentUser(res), Number(req.params.id))
  return res.status(STATUS[result]).json(result === 'OK' ? { ok: true } : { error: result })
})

export default router
