/**
 * Admin-only access to matchup guides listing.
 */
export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return

  const token = localStorage.getItem('adminAuth')
  if (!token) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/'))
  }
})
