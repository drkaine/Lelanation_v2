import type { NextFunction, Request, Response } from 'express'
import { getStatistiquesPool } from '../drizzle/statistiquesDb.js'
import { PostgresUserRepository } from '../services/users/PostgresUserRepository.js'
import { UserAuthService, type PublicUser } from '../services/users/UserAuthService.js'

let service: UserAuthService | undefined

export function getUserAuthService(): UserAuthService {
  if (!service) {
    const username = (process.env.ADMIN_USER_NAME ?? process.env.ADMIN_USERNAME)?.trim()
    const password = process.env.ADMIN_PASSWORD
    service = new UserAuthService(new PostgresUserRepository(getStatistiquesPool()), {
      envAdmin: username && password ? { username, password } : undefined,
    })
  }
  return service
}

export function readBearerToken(req: Request): string | null {
  const [scheme, token] = (req.header('authorization') ?? '').split(' ')
  return scheme === 'Bearer' && token ? token.trim() : null
}

/** Resolves the session user (null when no / invalid Bearer token). */
export async function resolveUser(req: Request): Promise<PublicUser | null> {
  const token = readBearerToken(req)
  return token ? getUserAuthService().authenticate(token) : null
}

export function currentUser(res: Response): PublicUser {
  return res.locals.user as PublicUser
}

/** 401 without a valid session; the user is then in `res.locals.user`. */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await resolveUser(req)
    if (!user) return res.status(401).json({ error: 'Authentication required' })
    res.locals.user = user
    return next()
  } catch (err) {
    console.error('[userAuth] session lookup failed', err)
    return res.status(500).json({ error: 'Session lookup failed' })
  }
}
