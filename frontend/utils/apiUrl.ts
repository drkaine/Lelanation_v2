import { useRuntimeConfig, useRequestURL } from '#app'

export function apiUrl(path: string): string {
  const cfg = useRuntimeConfig()

  // If apiBase is configured, always prefer it (useful in dev or when backend is separate).
  const configuredBase = (cfg.public.apiBase as string | undefined) || ''
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '') + path
  }

  // Default: same-origin `/api` (works with Nitro proxy rules in prod and devProxy in dev).
  if (process.client) {
    return path
  }

  // On server, Node fetch requires an absolute URL. Use the current request origin.
  const origin = useRequestURL().origin
  return origin.replace(/\/$/, '') + path
}
