/**
 * Matomo : suivi SPA uniquement après acceptation des cookies.
 * - Si consentement déjà accepté au chargement : on charge le script et on enregistre les pages.
 * - Si consentement refusé au chargement : un seul hit anonyme (pas de script).
 * - Si inconnu : rien (le bandeau gère accept → loadMatomo, reject → beacon anonyme).
 */

import { useMatomo } from '~/composables/useMatomo'

export default defineNuxtPlugin(nuxtApp => {
  if (typeof window === 'undefined') return

  const consent = useCookieConsentStore()
  const matomo = useMatomo()

  consent.load()

  const router = nuxtApp.$router as {
    currentRoute: { value: { fullPath: string } }
    afterEach: (cb: (to: { fullPath: string }) => void) => void
  }

  router.afterEach((to: { fullPath: string }) => {
    if (matomo.enabled && window.__matomoLoaded) matomo.trackPageView(to.fullPath)
  })

  if (consent.choice === 'accepted' && matomo.enabled) {
    matomo.loadMatomo()
    matomo.trackPageView(router.currentRoute.value.fullPath)
  } else if (consent.choice === 'rejected' && matomo.enabled) {
    matomo.sendAnonymousBeacon()
  }
})
