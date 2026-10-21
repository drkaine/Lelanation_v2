/**
 * @nuxt/icon endpoint. Must stay outside /api: nginx and the /api/** route rule
 * send those requests to the backend, so SSR and client icons would 404.
 */
export const ICON_API_ENDPOINT = '/_nuxt_icon'

/** Nitro strips /api from the path, so target must include /api to rebuild full path. */
export function apiProxyRouteRules(apiBase: string) {
  return {
    '/api/**': {
      proxy: apiBase + '/api/**',
    },
  }
}
