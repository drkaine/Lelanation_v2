/**
 * Middleware global : protège toutes les routes /admin/* (sauf /admin/login).
 * S'exécute avant chaque navigation, côté client uniquement (sessionStorage).
 */
export default defineNuxtRouteMiddleware(to => {
  if (!import.meta.client) return

  const path = to.path

  const isLoginRoute = /\/admin\/login(\/|$)/.test(path)
  const isAdminRoute = /\/admin(\/|$)/.test(path)

  if (isLoginRoute || !isAdminRoute) return

  const token = localStorage.getItem('adminAuth')
  if (!token) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/admin/login'))
  }
})
