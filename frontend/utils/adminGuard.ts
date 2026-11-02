const LOGIN_RE = /\/admin\/(login|connexion)(\/|$)/
const ADMIN_RE = /(^|\/)admin(\/|$)/

export type AdminGuardDecision = 'allow' | 'login'

/**
 * Décide si une navigation vers `path` doit passer par la connexion admin.
 * Une route inconnue (`matched: false`) n'est pas redirigée : elle doit afficher la 404.
 */
export function adminGuardDecision(input: {
  path: string
  matched: boolean
  hasToken: boolean
}): AdminGuardDecision {
  const { path, matched, hasToken } = input
  if (!matched) return 'allow'
  if (LOGIN_RE.test(path)) return 'allow'
  if (!ADMIN_RE.test(path)) return 'allow'
  return hasToken ? 'allow' : 'login'
}
