import { useRuntimeConfig } from '#app'

function getRuntimeConfigSafe(): any {
  try {
    return useRuntimeConfig()
  } catch {
    // Can happen if called outside of a Nuxt app context (e.g. certain store calls).
    return { public: {} }
  }
}

export function apiUrl(path: string): string {
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

  const siteUrl =
    (cfg.public?.siteUrl as string | undefined) ||
    (process.env.NUXT_PUBLIC_SITE_URL as string | undefined) ||
    'https://www.lelanation.fr'
  return siteUrl.replace(/\/$/, '') + path
}
