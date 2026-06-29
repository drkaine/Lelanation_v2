/**
 * Matomo: chargement conditionnel au consentement + trace anonyme au refus.
 * - Acceptation : un hit par chargement de page (modèle MPA / SSR Nuxt).
 * - Refus : un seul hit anonyme (pas de script, pas de cookie).
 *
 * Pas de suivi router.afterEach : chaque URL est rendue côté serveur ;
 * on enregistre la page une fois matomo.js prêt (après redirects i18n éventuels).
 */

declare global {
  interface Window {
    _paq?: [string, ...unknown[]][]
    __matomoLoaded?: boolean
  }
}

const MATOMO_SCRIPT_ID = 'matomo-tracker'
const MATOMO_JS_ID = 'matomo-js'
/** Coalesce client redirects on first paint (i18n, middleware) into one hit. */
const TRACK_DEBOUNCE_MS = 400

let trackDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lastTrackedUrl: string | null = null
let pendingTrack = false

function sendPageView() {
  if (typeof window === 'undefined' || !window._paq || !window.__matomoLoaded) return

  const url = window.location.href
  if (lastTrackedUrl === url) return

  lastTrackedUrl = url
  window._paq.push(['setCustomUrl', url])
  window._paq.push(['setDocumentTitle', document.title])
  window._paq.push(['trackPageView'])
}

function flushPendingTrack() {
  if (!pendingTrack) return
  pendingTrack = false
  if (trackDebounceTimer) {
    clearTimeout(trackDebounceTimer)
    trackDebounceTimer = null
  }
  sendPageView()
}

export function useMatomo() {
  const config = useRuntimeConfig().public
  const host = (config as { matomoHost?: string }).matomoHost
  const siteId = (config as { matomoSiteId?: string }).matomoSiteId
  const enabled = Boolean(host && siteId)

  /** Envoie un seul hit anonyme sans charger le script ni poser de cookie. */
  function sendAnonymousBeacon() {
    if (!enabled || typeof window === 'undefined') return
    const url = `${host!.replace(/\/$/, '')}/matomo.php?idsite=${encodeURIComponent(siteId!)}&rec=1`
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(url)
      return
    }
    const img = new Image()
    img.src = url
  }

  /** Charge le script Matomo. Appeler trackPageView ensuite (une fois par chargement document). */
  function loadMatomo() {
    if (!enabled || typeof window === 'undefined') return
    if (document.getElementById(MATOMO_SCRIPT_ID)) return

    const baseUrl = host!.replace(/\/$/, '')
    window._paq = window._paq || []
    window._paq.push(['setTrackerUrl', `${baseUrl}/matomo.php`])
    window._paq.push(['setSiteId', `${siteId}`])
    window._paq.push(['enableLinkTracking'])

    const marker = document.createElement('meta')
    marker.id = MATOMO_SCRIPT_ID
    document.head.appendChild(marker)

    const existingScript = document.getElementById(MATOMO_JS_ID) as HTMLScriptElement | null
    if (existingScript) {
      if (window.__matomoLoaded) flushPendingTrack()
      return
    }

    const trackerScript = document.createElement('script')
    trackerScript.async = true
    trackerScript.src = `${baseUrl}/matomo.js`
    trackerScript.id = MATOMO_JS_ID
    trackerScript.onload = () => {
      window.__matomoLoaded = true
      flushPendingTrack()
    }
    ;(document.head || document.body || document.documentElement).appendChild(trackerScript)
  }

  /**
   * Enregistre la page courante (URL réelle au moment de l'envoi).
   * Attend matomo.js ; regroupe les redirects client du premier paint.
   */
  function trackPageView() {
    if (!enabled || typeof window === 'undefined') return

    pendingTrack = true

    if (!window.__matomoLoaded) return

    if (trackDebounceTimer) clearTimeout(trackDebounceTimer)
    trackDebounceTimer = setTimeout(() => {
      trackDebounceTimer = null
      flushPendingTrack()
    }, TRACK_DEBOUNCE_MS)
  }

  return {
    enabled,
    loadMatomo,
    sendAnonymousBeacon,
    trackPageView,
  }
}
