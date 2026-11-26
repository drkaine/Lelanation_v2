import { resolveSiteUrl } from './siteUrl'
import {
  type StatsRegion,
  getStatsRegions,
  regionsFromCookieHeader,
  withStatsRegions,
} from './statsRegion'
import {
  type StatsOtpPlayers,
  getStatsOtpPlayers,
  otpPlayersFromCookieHeader,
  withStatsOtpPlayers,
} from './statsOtpPlayers'

function getRuntimeConfigSafe(): any {
  // Outside a Nuxt app context (e.g. store calls after an await), useRuntimeConfig() reports
  // NUXT_E1001 on stderr before throwing: probe with tryUseNuxtApp() instead.
  return tryUseNuxtApp()?.$config ?? { public: {} }
}

/** Client : région posée par le plugin ; serveur : cookie de la requête (pas d'état partagé entre requêtes). */
function currentStatsRegions(): StatsRegion[] {
  if (process.client) return getStatsRegions()
  return regionsFromCookieHeader(tryUseNuxtApp()?.ssrContext?.event?.node?.req?.headers?.cookie)
}

function currentStatsOtpPlayers(): StatsOtpPlayers {
  if (process.client) return getStatsOtpPlayers()
  return otpPlayersFromCookieHeader(tryUseNuxtApp()?.ssrContext?.event?.node?.req?.headers?.cookie)
}

/** Chemin relatif avec la région et le filtre OTP des stats (pour useRequestFetch, qui ne passe pas par apiUrl). */
export function statsRegionPath(path: string): string {
  return withStatsOtpPlayers(
    withStatsRegions(path, currentStatsRegions()),
    currentStatsOtpPlayers()
  )
}

export function apiUrl(rawPath: string): string {
  const path = statsRegionPath(rawPath)
  const cfg = getRuntimeConfigSafe()
  const configuredBase =
    (cfg.public?.apiBase as string | undefined) ||
    (process.env.NUXT_PUBLIC_API_BASE as string | undefined) ||
    ''

  // Client: by default use same-origin (Nitro proxy). In local/dev setups, if apiBase points to a local
  // backend, call it directly to avoid stale/misconfigured proxy targets.
  if (process.client) {
    const localApiBase = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(configuredBase.trim())
    const browserOnLocalhost =
      typeof window !== 'undefined' &&
      /^(localhost|127\.0\.0\.1|::1)$/i.test(window.location.hostname)
    if (localApiBase && browserOnLocalhost) {
      return configuredBase.replace(/\/$/, '') + path
    }
    return path
  }

  // Server: need absolute URL. Use apiBase if set (backend on different host/port), else siteUrl.
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '') + path
  }

  const siteUrl = resolveSiteUrl(
    (cfg.public?.siteUrl as string | undefined) ||
      (process.env.NUXT_PUBLIC_SITE_URL as string | undefined)
  )
  return siteUrl.replace(/\/$/, '') + path
}
