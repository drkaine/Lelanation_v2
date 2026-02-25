/**
 * Middleware global : protège toutes les routes /admin/* (sauf /admin/login).
 * S'exécute avant chaque navigation, côté client uniquement (sessionStorage).
 */
export default defineNuxtRouteMiddleware(to => {
  if (!import.meta.client) return

  const path = to.path

  // Exclure les routes non-admin et la page de login elle-même
  const isAdminRoute = /\/admin(\/|$)/.test(path)
  const isLoginRoute = /\/admin\/login(\/|$)/.test(path)

  if (!isAdminRoute || isLoginRoute) return

  const token = sessionStorage.getItem('adminAuth')
  if (!token) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/admin/login'))
  }
})
