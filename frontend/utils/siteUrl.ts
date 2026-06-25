/** Canonical production origin (www). */
export const DEFAULT_SITE_URL = 'https://www.lelanation.fr'

const NON_WWW_HOST = 'lelanation.fr'

/** Normalize site URL for canonicals, OG tags, JSON-LD, and sitemaps. Always prefers www. */
export function resolveSiteUrl(raw?: string | null): string {
  const trimmed = String(raw ?? '')
    .trim()
    .replace(/\/$/, '')
  if (!trimmed) return DEFAULT_SITE_URL

  try {
    const withProto = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
    const url = new URL(withProto)
    if (url.hostname === NON_WWW_HOST) {
      url.hostname = `www.${NON_WWW_HOST}`
      return url.origin
    }
    return url.origin
  } catch {
    if (trimmed === `https://${NON_WWW_HOST}` || trimmed === `http://${NON_WWW_HOST}`) {
      return DEFAULT_SITE_URL
    }
    return trimmed
  }
}

export function absoluteSitePath(siteUrl: string, path: string): string {
  const base = resolveSiteUrl(siteUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

/** Default Open Graph image (`public/og/default.png` 1200×630). */
export function defaultOgImageUrl(siteUrl: string): string {
  return absoluteSitePath(siteUrl, '/og/default.png')
}

/** Page-specific static OG image under `public/og/{slug}.png`. */
export function pageOgImageUrl(siteUrl: string, slug: string): string {
  const normalized = slug.replace(/^\/+/, '').replace(/\.png$/i, '')
  return absoluteSitePath(siteUrl, `/og/${normalized}.png`)
}
