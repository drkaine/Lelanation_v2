/** Valeurs de l'enum backend `lol_region` (allowlist du paramètre `?region=`). */
export const STATS_REGIONS = [
  'EUW1',
  'EUN1',
  'NA1',
  'KR',
  'BR1',
  'LA1',
  'LA2',
  'OC1',
  'TR1',
  'JP1',
  'ME1',
] as const
export type StatsRegion = (typeof STATS_REGIONS)[number]

const LABELS: Record<StatsRegion, string> = {
  EUW1: 'EUW',
  EUN1: 'EUNE',
  NA1: 'NA',
  KR: 'KR',
  BR1: 'BR',
  LA1: 'LAN',
  LA2: 'LAS',
  OC1: 'OCE',
  TR1: 'TR',
  JP1: 'JP',
  ME1: 'ME',
}

export const STATS_REGION_OPTIONS = STATS_REGIONS.map(value => ({ value, label: LABELS[value] }))

/**
 * Régions proposées dans le filtre : celles ayant des matchs en base (`GET /api/stats/regions`),
 * plus les régions déjà sélectionnées. Réponse absente, invalide ou vide = toutes (filtre jamais vide).
 */
export function visibleStatsRegionOptions(response: unknown, selected: readonly StatsRegion[]) {
  const list =
    response && typeof response === 'object' && 'regions' in response ? response.regions : null
  const inDb = Array.isArray(list) ? parseStatsRegions(list.join(',')) : []
  if (inDb.length === 0) return STATS_REGION_OPTIONS
  const shown = new Set<StatsRegion>([...inDb, ...selected])
  return STATS_REGION_OPTIONS.filter(o => shown.has(o.value))
}

/** Cookie lu par le SSR et le client ; absent = toutes régions mélangées. */
export const STATS_REGION_COOKIE = 'stats_region'

/** Régions connues (liste séparée par des virgules), ordre de l'enum ; vide, `all` ou inconnue = [] (toutes). */
export function parseStatsRegions(value: unknown): StatsRegion[] {
  if (typeof value !== 'string') return []
  const wanted = new Set(value.split(',').map(part => part.trim().toUpperCase()))
  return STATS_REGIONS.filter(region => wanted.has(region))
}

export function serializeStatsRegions(regions: readonly StatsRegion[]): string {
  return regions.join(',')
}

/** Ajoute ou retire une région, résultat dans l'ordre de l'enum. */
export function toggleStatsRegion(
  regions: readonly StatsRegion[],
  region: StatsRegion
): StatsRegion[] {
  const next = new Set(regions)
  if (next.has(region)) next.delete(region)
  else next.add(region)
  return STATS_REGIONS.filter(r => next.has(r))
}

export function regionsFromCookieHeader(header: string | undefined): StatsRegion[] {
  if (!header) return []
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== STATS_REGION_COOKIE) continue
    try {
      return parseStatsRegions(decodeURIComponent(rest.join('=')))
    } catch {
      return []
    }
  }
  return []
}

const STATS_PATH = /\/api\/stats(?:[/?#]|$)/

/** Ajoute ou remplace `region=` sur une URL /api/stats ; autres URL et [] inchangées. */
export function withStatsRegions(url: string, regions: readonly StatsRegion[]): string {
  if (regions.length === 0 || !STATS_PATH.test(url)) return url
  const value = `region=${serializeStatsRegions(regions)}`
  const hashAt = url.indexOf('#')
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url
  const queryAt = base.indexOf('?')
  if (queryAt < 0) return `${base}?${value}${hash}`
  const path = base.slice(0, queryAt)
  const params = base
    .slice(queryAt + 1)
    .split('&')
    .filter(Boolean)
  const index = params.findIndex(p => p.split('=')[0] === 'region')
  if (index >= 0) params[index] = value
  else params.push(value)
  return `${path}?${params.join('&')}${hash}`
}

/** Régions côté client (posées par le plugin depuis le cookie). Le SSR lit le cookie de la requête. */
let clientRegions: StatsRegion[] = []

export function getStatsRegions(): StatsRegion[] {
  return clientRegions
}

export function setStatsRegions(regions: StatsRegion[]): void {
  clientRegions = regions
}
