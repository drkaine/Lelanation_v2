/** Canonical production origin (www). */
export const DEFAULT_SITE_URL = 'https://www.lelanation.fr'

const NON_WWW_HOST = 'https://lelanation.fr'

/** Normalize site URL for canonicals, OG tags, JSON-LD, and sitemaps. */
export function resolveSiteUrl(raw?: string | null): string {
  const trimmed = String(raw ?? '')
    .trim()
    .replace(/\/$/, '')
  if (!trimmed) return DEFAULT_SITE_URL
  if (trimmed === NON_WWW_HOST) return DEFAULT_SITE_URL
  return trimmed
}

export function absoluteSitePath(siteUrl: string, path: string): string {
  const base = resolveSiteUrl(siteUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

/** Default Open Graph image (add `public/og-default.png` 1200×630). */
export function defaultOgImageUrl(siteUrl: string): string {
  return absoluteSitePath(siteUrl, '/og-default.png')
}
