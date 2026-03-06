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

  // Client: always use same-origin (path only). Requests go to current domain and are proxied by Nitro.
  // Using apiBase on client would point to localhost on the user's machine, not the server.
  if (process.client) {
    return path
  }

  // Server: need absolute URL. Use apiBase if set (backend on different host/port), else siteUrl.
  const configuredBase =
    (cfg.public?.apiBase as string | undefined) ||
    (process.env.NUXT_PUBLIC_API_BASE as string | undefined) ||
    ''
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '') + path
  }

  const siteUrl =
    (cfg.public?.siteUrl as string | undefined) ||
    (process.env.NUXT_PUBLIC_SITE_URL as string | undefined) ||
    'https://www.lelanation.fr'
  return siteUrl.replace(/\/$/, '') + path
}
