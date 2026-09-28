/** Query / route param parsing shared by the /api/stats routes. */

/** First string value of a query param; null when empty or JSON-like (`[]`, `[...]`). */
export function queryString(value: unknown): string | null {
  if (value == null) return null
  let s: string | null = null
  if (Array.isArray(value)) s = typeof value[0] === 'string' ? value[0] : null
  else if (typeof value === 'string') s = value
  if (s == null || s === '' || s === '[]' || s.startsWith('[')) return null
  return s
}

/** Return array of strings from query param (single value or repeated). */
export function queryStringArray(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((x): x is string => typeof x === 'string' && x !== '' && !x.startsWith('['))
  }
  if (typeof value === 'string' && value !== '' && !value.startsWith('[')) return [value]
  return []
}

/** rankTier répété ou liste : ex. rankTier=GOLD&rankTier=PLATINUM → ['GOLD','PLATINUM']. */
export function rankTierParam(value: unknown): string[] | null {
  const arr = queryStringArray(value)
  if (arr.length === 0) return null
  const tiers = arr
    .flatMap((s) => (s.includes(',') ? s.split(',').map((x) => x.trim()) : [s.trim()]))
    .map((s) => s.toUpperCase())
    .filter(Boolean)
    /** Même sémantique que `/tier-list` : `all` / `ALL` = pas de filtre par ligue (pas de `rank_tier = 'ALL'` en SQL). */
    .filter((s) => s !== 'ALL' && s !== '*')
  return tiers.length ? tiers : null
}

export type StatsFilters = { version: string | null; rankTier: string[] | null; role: string | null }

/** Cohort filters common to most stats routes: `version`, `rankTier` (repeatable), `role`. */
export function statsFilters(query: Record<string, unknown>): StatsFilters {
  return {
    version: queryString(query.version),
    rankTier: rankTierParam(query.rankTier),
    role: queryString(query.role),
  }
}

/** `:championId` route param as a number; null when not numeric (or not > 0 with `positive`). */
export function championIdParam(
  raw: string | string[] | undefined,
  opts: { positive?: boolean } = {}
): number | null {
  const id = parseInt(Array.isArray(raw) ? raw[0]! : String(raw), 10)
  if (Number.isNaN(id)) return null
  if (opts.positive && id <= 0) return null
  return id
}
