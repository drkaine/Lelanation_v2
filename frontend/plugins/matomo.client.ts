/**
 * Matomo : un hit par chargement de page (MPA / SSR), après acceptation des cookies.
 * - Consentement accepté : charge matomo.js puis enregistre la page courante.
 * - Consentement refusé : un seul hit anonyme.
 * - Inconnu : le bandeau cookies gère accept / reject.
 */

import { useMatomo } from '~/composables/useMatomo'

export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined') return

  const consent = useCookieConsentStore()
  const matomo = useMatomo()

  consent.load()

  if (consent.choice === 'accepted' && matomo.enabled) {
    matomo.loadMatomo()
    matomo.trackPageView()
  } else if (consent.choice === 'rejected' && matomo.enabled) {
    matomo.sendAnonymousBeacon()
  }
})
