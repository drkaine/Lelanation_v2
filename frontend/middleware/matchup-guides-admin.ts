/**
 * Admin-only access to matchup sheets listing and detail.
 */
export default defineNuxtRouteMiddleware(to => {
  if (!import.meta.client) return

  const path = to.path
  if (!/\/matchups\/sheets(\/|$)/.test(path)) return

  const token = localStorage.getItem('adminAuth')
  if (!token) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/'))
  }
})
