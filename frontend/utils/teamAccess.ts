import type { StoredSession, UserRole } from './userSession'

const TEAM_RE = /^(\/[a-z]{2})?\/equipe(\/|$)/

export type TeamGuardDecision = 'allow' | 'login' | 'forbidden'

/** Page /equipe : gestion des comptes, ouverte à admin et lelariva. */
export function canAccessTeamPage(role: UserRole | null): boolean {
  return role === 'admin' || role === 'lelariva'
}

export function teamGuardDecision(input: {
  path: string
  role: UserRole | null
}): TeamGuardDecision {
  if (!TEAM_RE.test(input.path)) return 'allow'
  if (!input.role) return 'login'
  return canAccessTeamPage(input.role) ? 'allow' : 'forbidden'
}

/** En-tête des appels /api/admin : session Bearer d'un admin, sinon jeton Basic historique. */
export function adminAuthHeader(
  session: StoredSession | null,
  basicToken: string | null
): { Authorization: string } | null {
  if (session?.user.role === 'admin') return { Authorization: `Bearer ${session.token}` }
  if (basicToken) return { Authorization: `Basic ${basicToken}` }
  return null
}

export function inviteLink(origin: string, registerPath: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}${registerPath}?code=${encodeURIComponent(code)}`
}

/** Rôles proposés dans le sélecteur d'un compte : ceux que l'acteur peut donner + le rôle actuel. */
export function roleChoicesFor(invitable: readonly UserRole[], current: UserRole): UserRole[] {
  return invitable.includes(current) ? [...invitable] : [current, ...invitable]
}

/** Backend pas encore déployé avec /api/users : retomber sur l'auth Basic admin. */
export function isLoginEndpointMissing(status: number): boolean {
  return status === 404
}
