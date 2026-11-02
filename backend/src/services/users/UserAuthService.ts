import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import { hashPassword, verifyPassword } from './passwordHash.js'
import type { InvitationRecord, UserRecord, UserRepository } from './UserRepository.js'
import { canManageUser, invitableRoles, type UserRole } from './userRoles.js'

export interface PublicUser {
  id: number
  username: string
  role: UserRole
}

export interface PublicUserWithDate extends PublicUser {
  createdAt: string
}

export type RegisterError = 'INVALID_CODE' | 'USERNAME_TAKEN' | 'INVALID_USERNAME' | 'WEAK_PASSWORD'
export type AuthSuccess = { ok: true; token: string; user: PublicUser }

export const INVITATION_TTL_MS = 7 * 24 * 3600_000
export const SESSION_TTL_MS = 30 * 24 * 3600_000
const USERNAME_REGEX = /^[A-Za-z0-9_-]{3,24}$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128
/** No 0/O/1/I to avoid typos when the code is read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

interface Options {
  envAdmin?: { username: string; password: string }
  now?: () => Date
}

function toPublic(user: UserRecord): PublicUser {
  return { id: user.id, username: user.username, role: user.role }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time compare (hash first so lengths never leak). */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

function generateCode(): string {
  const pick = () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  const part = () => Array.from({ length: 4 }, pick).join('')
  return `${part()}-${part()}`
}

/** Accepts lowercase, spaces or a missing dash: "abcd efgh" → "ABCD-EFGH". */
export function normalizeInvitationCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact
}

export class UserAuthService {
  private readonly now: () => Date

  constructor(
    private readonly repo: UserRepository,
    private readonly options: Options = {}
  ) {
    this.now = options.now ?? (() => new Date())
  }

  async createInvitation(
    actor: PublicUser,
    role: UserRole
  ): Promise<{ ok: true; invitation: InvitationRecord } | { ok: false; error: 'FORBIDDEN' }> {
    if (!invitableRoles(actor.role).includes(role)) return { ok: false, error: 'FORBIDDEN' }
    const createdAt = this.now()
    const invitation: InvitationRecord = {
      code: generateCode(),
      role,
      createdBy: actor.id > 0 ? actor.id : null,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + INVITATION_TTL_MS),
      usedAt: null,
      usedBy: null,
    }
    await this.repo.createInvitation(invitation)
    return { ok: true, invitation }
  }

  /** Admin sees every pending code; lelariva only the codes they created. */
  async listInvitations(actor: PublicUser): Promise<InvitationRecord[]> {
    if (invitableRoles(actor.role).length === 0) return []
    const pending = await this.repo.listPendingInvitations(this.now())
    return actor.role === 'admin' ? pending : pending.filter(i => i.createdBy === actor.id)
  }

  async revokeInvitation(actor: PublicUser, code: string): Promise<boolean> {
    const own = await this.listInvitations(actor)
    if (!own.some(i => i.code === code)) return false
    await this.repo.deleteInvitation(code)
    return true
  }

  async register(input: {
    code: string
    username: string
    password: string
  }): Promise<AuthSuccess | { ok: false; error: RegisterError }> {
    const username = input.username.trim()
    if (!USERNAME_REGEX.test(username)) return { ok: false, error: 'INVALID_USERNAME' }
    if (input.password.length < PASSWORD_MIN || input.password.length > PASSWORD_MAX) {
      return { ok: false, error: 'WEAK_PASSWORD' }
    }
    if (await this.repo.findUserByUsername(username)) return { ok: false, error: 'USERNAME_TAKEN' }

    const code = normalizeInvitationCode(input.code)
    const invitation = await this.repo.consumeInvitation(code, this.now())
    if (!invitation) return { ok: false, error: 'INVALID_CODE' }

    let user: UserRecord
    try {
      user = await this.repo.createUser({
        username,
        passwordHash: await hashPassword(input.password),
        role: invitation.role,
      })
    } catch {
      // Unique violation on a concurrent signup: give the code back.
      await this.repo.releaseInvitation(code)
      return { ok: false, error: 'USERNAME_TAKEN' }
    }
    await this.repo.attachInvitationUser(code, user.id)
    return this.openSession(user)
  }

  async login(
    username: string,
    password: string
  ): Promise<AuthSuccess | { ok: false; error: 'INVALID_CREDENTIALS' }> {
    const envUser = await this.loginEnvAdmin(username, password)
    if (envUser) return this.openSession(envUser)

    const user = await this.repo.findUserByUsername(username.trim())
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { ok: false, error: 'INVALID_CREDENTIALS' }
    }
    return this.openSession(user)
  }

  async authenticate(token: string): Promise<PublicUser | null> {
    if (!token) return null
    const session = await this.repo.findSession(hashToken(token))
    if (!session || session.expiresAt <= this.now()) return null
    const user = await this.repo.findUserById(session.userId)
    return user ? toPublic(user) : null
  }

  async logout(token: string): Promise<void> {
    if (token) await this.repo.deleteSession(hashToken(token))
  }

  async listUsers(actor: PublicUser): Promise<PublicUserWithDate[] | null> {
    if (invitableRoles(actor.role).length === 0) return null
    const users = (await this.repo.listUsers()).filter(u => canManageUser(actor.role, u.role))
    return users.map(u => ({ ...toPublic(u), createdAt: u.createdAt.toISOString() }))
  }

  async setRole(actor: PublicUser, userId: number, role: UserRole): Promise<'OK' | 'FORBIDDEN' | 'SELF' | 'NOT_FOUND'> {
    if (actor.id === userId) return actor.role === 'admin' ? 'SELF' : 'FORBIDDEN'
    if (!canManageUser(actor.role, role)) return 'FORBIDDEN'
    const target = await this.repo.findUserById(userId)
    if (!target) return 'NOT_FOUND'
    if (!canManageUser(actor.role, target.role)) return 'FORBIDDEN'
    await this.repo.updateUser(userId, { role })
    return 'OK'
  }

  async deleteUser(actor: PublicUser, userId: number): Promise<'OK' | 'FORBIDDEN' | 'SELF' | 'NOT_FOUND'> {
    if (actor.id === userId) return actor.role === 'admin' ? 'SELF' : 'FORBIDDEN'
    const target = await this.repo.findUserById(userId)
    if (!target) return 'NOT_FOUND'
    if (!canManageUser(actor.role, target.role)) return 'FORBIDDEN'
    await this.repo.deleteUser(userId)
    return 'OK'
  }

  /** The .env admin stays a super-admin: on login it is mirrored as an admin row. */
  private async loginEnvAdmin(username: string, password: string): Promise<UserRecord | null> {
    const env = this.options.envAdmin
    if (!env) return null
    const userOk = safeEqual(username, env.username)
    const passOk = safeEqual(password, env.password)
    if (!userOk || !passOk) return null
    const existing = await this.repo.findUserByUsername(env.username)
    const passwordHash = await hashPassword(env.password)
    if (!existing) return this.repo.createUser({ username: env.username, passwordHash, role: 'admin' })
    await this.repo.updateUser(existing.id, { passwordHash, role: 'admin' })
    return { ...existing, passwordHash, role: 'admin' }
  }

  private async openSession(user: UserRecord): Promise<AuthSuccess> {
    const token = randomBytes(32).toString('base64url')
    await this.repo.createSession(hashToken(token), user.id, new Date(this.now().getTime() + SESSION_TTL_MS))
    return { ok: true, token, user: toPublic(user) }
  }
}
