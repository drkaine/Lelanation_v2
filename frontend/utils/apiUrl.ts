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

  // If apiBase is configured, always prefer it (useful in dev or when backend is separate).
  const configuredBase =
    (cfg.public?.apiBase as string | undefined) ||
    (process.env.NUXT_PUBLIC_API_BASE as string | undefined) ||
    ''
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '') + path
  }

  // Default: same-origin `/api` (works with Nitro proxy rules in prod and devProxy in dev).
  if (process.client) {
    return path
  }

  // On server, Node fetch requires an absolute URL.
  // Avoid relying on request-scoped composables (can be missing in store actions).
  const siteUrl =
    (cfg.public?.siteUrl as string | undefined) ||
    (process.env.NUXT_PUBLIC_SITE_URL as string | undefined) ||
    'https://www.lelanation.fr'
  return siteUrl.replace(/\/$/, '') + path
}
