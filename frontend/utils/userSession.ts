export const USER_ROLES = ['admin', 'lelariva', 'lelateam'] as const
export type UserRole = (typeof USER_ROLES)[number]
export type BuildVisibility = 'public' | 'private' | 'shared'

export interface SessionUser {
  id: number
  username: string
  role: UserRole
}

export interface StoredSession {
  token: string
  user: SessionUser
}

export const USER_SESSION_KEY = 'userSession'

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== 'object') return false
  const u = value as Record<string, unknown>
  return typeof u.id === 'number' && typeof u.username === 'string' && isUserRole(u.role)
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    const { token, user } = data as Record<string, unknown>
    if (typeof token !== 'string' || !token || !isSessionUser(user)) return null
    return { token, user: { id: user.id, username: user.username, role: user.role } }
  } catch {
    return null
  }
}

export function postLoginPath(role: UserRole): string {
  if (role === 'admin') return '/admin'
  return role === 'lelariva' ? '/equipe' : '/builds'
}

export function buildVisibilityOptions(role: UserRole | null): BuildVisibility[] {
  return role ? ['public', 'private', 'shared'] : ['public', 'private']
}

export function canManageSharedBuilds(role: UserRole | null): boolean {
  return role === 'admin' || role === 'lelariva'
}

const REGISTER_ERRORS: Record<string, string> = {
  INVALID_CODE: 'auth.errors.invalidCode',
  USERNAME_TAKEN: 'auth.errors.usernameTaken',
  INVALID_USERNAME: 'auth.errors.invalidUsername',
  WEAK_PASSWORD: 'auth.errors.weakPassword',
  INVALID_CREDENTIALS: 'auth.errors.invalidCredentials',
}

export function registerErrorKey(code: unknown): string {
  return (typeof code === 'string' && REGISTER_ERRORS[code]) || 'auth.errors.generic'
}
