/**
 * Matomo: chargement conditionnel au consentement + trace anonyme au refus.
 * - Acceptation : chargement du script complet et suivi SPA.
 * - Refus (ou visite avec refus déjà enregistré) : un seul hit anonyme (pas de script, pas de cookie).
 */

declare global {
  interface Window {
    _paq?: [string, ...unknown[]][]
    __matomoLoaded?: boolean
  }
}

const MATOMO_SCRIPT_ID = 'matomo-tracker'
const MATOMO_JS_ID = 'matomo-js'

export function useMatomo() {
  const config = useRuntimeConfig().public
  const host = (config as { matomoHost?: string }).matomoHost
  const siteId = (config as { matomoSiteId?: string }).matomoSiteId
  const enabled = Boolean(host && siteId)

  /** Envoie un seul hit anonyme (pixel) sans charger le script ni poser de cookie. */
  function sendAnonymousBeacon() {
    if (!enabled || typeof window === 'undefined') return
    const url = `${host!.replace(/\/$/, '')}/matomo.php?idsite=${encodeURIComponent(siteId!)}&rec=1`
    const img = new Image()
    img.src = url
  }

  /** Charge le script Matomo et envoie la page vue courante. À appeler uniquement après acceptation. */
  function loadMatomo() {
    if (!enabled || typeof window === 'undefined') return
    if (document.getElementById(MATOMO_SCRIPT_ID)) return

    const baseUrl = host!.replace(/\/$/, '')
    window._paq = window._paq || []
    window._paq.push(['setTrackerUrl', `${baseUrl}/matomo.php`])
    window._paq.push(['setSiteId', `${siteId}`])
    window._paq.push(['trackPageView'])
    window._paq.push(['enableLinkTracking'])

    // Mark Matomo as initialized before loading the external script
    // so repeated calls don't try to inject it again.
    const marker = document.createElement('meta')
    marker.id = MATOMO_SCRIPT_ID
    document.head.appendChild(marker)

    if (!document.getElementById(MATOMO_JS_ID)) {
      const trackerScript = document.createElement('script')
      trackerScript.async = true
      trackerScript.src = `${baseUrl}/matomo.js`
      trackerScript.id = MATOMO_JS_ID
      ;(document.head || document.body || document.documentElement).appendChild(trackerScript)
    }

    window.__matomoLoaded = true
  }

  /** Envoie une page vue via _paq (à utiliser après loadMatomo). */
  function trackPageView(path: string) {
    if (!enabled || typeof window === 'undefined' || !window._paq) return
    window._paq.push(['setCustomUrl', path])
    window._paq.push(['trackPageView'])
  }

  return {
    enabled,
    loadMatomo,
    sendAnonymousBeacon,
    trackPageView,
  }
}
