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
    const script = document.createElement('script')
    script.id = MATOMO_SCRIPT_ID
    script.textContent = `
      var _paq = window._paq = window._paq || [];
      _paq.push(['setTrackerUrl', '${baseUrl}/matomo.php']);
      _paq.push(['setSiteId', '${siteId}']);
      _paq.push(['trackPageView']);
      _paq.push(['enableLinkTracking']);
      (function() {
        var u = '${baseUrl}/';
        var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
        g.async = true; g.src = u + 'matomo.js'; g.id = 'matomo-js';
        s.parentNode.insertBefore(g, s);
      })();
    `
    document.head.appendChild(script)
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
