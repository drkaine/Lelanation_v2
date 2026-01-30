/**
 * Redirects to the preferred locale path when the user lands on an unprefixed URL
 * (e.g. /builds) but had previously chosen a non-default locale (e.g. en).
 * Ensures the language choice is preserved across direct links and bookmarks.
 */
export default defineNuxtPlugin(() => {
  const route = useRoute()
  const cookie = useCookie<string>('i18n_redirected')

  if (cookie.value === 'en' && !route.path.startsWith('/en')) {
    const path = route.fullPath.startsWith('/') ? route.fullPath : `/${route.fullPath}`
    navigateTo(`/en${path}`, { replace: true })
  }
})
