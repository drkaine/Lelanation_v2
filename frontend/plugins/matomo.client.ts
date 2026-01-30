/**
 * Matomo – consentement et suivi des routes (SPA).
 * Le code de suivi est injecté dans le head via app.vue pour que la vérification Matomo le détecte.
 */
const COOKIE_CONSENT_KEY = 'cookie_consent'

export default defineNuxtPlugin(nuxtApp => {
  if (typeof window === 'undefined') return

  const _paq = window._paq
  if (!_paq) return

  nuxtApp.hook('app:mounted', () => {
    try {
      if (localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted') {
        _paq.push(['setConsentGiven'])
        _paq.push(['trackPageView'])
      }
    } catch {
      // ignore
    }
  })

  nuxtApp.$router.afterEach(to => {
    try {
      if (localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted' && _paq) {
        _paq.push(['setCustomUrl', to.fullPath])
        _paq.push(['trackPageView'])
      }
    } catch {
      // ignore
    }
  })
})
