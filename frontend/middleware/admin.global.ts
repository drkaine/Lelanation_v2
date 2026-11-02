import { adminGuardDecision } from '~/utils/adminGuard'
import { teamGuardDecision } from '~/utils/teamAccess'
import { hasAdminAccess } from '~/composables/useAdminAuth'
import { readStoredSession } from '~/composables/useUserSession'

/**
 * Middleware global, côté client (stockage navigateur) :
 * - /admin/* (sauf /admin/login) : jeton Basic ou session d'un compte admin ;
 * - /equipe : session admin ou lelariva.
 * Une route inconnue n'est pas redirigée : elle affiche la 404.
 */
export default defineNuxtRouteMiddleware(to => {
  if (!import.meta.client) return
  const localePath = useLocalePath()

  const admin = adminGuardDecision({
    path: to.path,
    matched: to.matched.length > 0,
    hasToken: hasAdminAccess(),
  })
  if (admin === 'login') return navigateTo(localePath('/admin/login'))

  const team = teamGuardDecision({ path: to.path, role: readStoredSession()?.user.role ?? null })
  if (team === 'login')
    return navigateTo({ path: localePath('/admin/login'), query: { redirect: to.fullPath } })
  if (team === 'forbidden') {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Forbidden' }))
  }
})
