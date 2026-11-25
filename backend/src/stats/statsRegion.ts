import { AsyncLocalStorage } from 'node:async_hooks'

/** Valeurs de l'enum Postgres `lol_region`. */
export const STATS_REGIONS = ['EUW1', 'EUN1', 'NA1', 'KR', 'BR1', 'LA1', 'LA2', 'OC1', 'TR1', 'JP1', 'ME1'] as const
export type StatsRegion = (typeof STATS_REGIONS)[number]

const ALLOWED: ReadonlySet<string> = new Set(STATS_REGIONS)
const storage = new AsyncLocalStorage<StatsRegion[] | null>()

function isStatsRegion(value: string): value is StatsRegion {
  return ALLOWED.has(value)
}

/**
 * `?region=` (liste séparée par des virgules ou répétée) → régions connues, ordre de l'enum, sans doublon ;
 * vide, `all` ou aucune connue = null (toutes régions mélangées).
 */
export function regionParam(value: unknown): StatsRegion[] | null {
  const raw = Array.isArray(value) ? value : [value]
  const wanted = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') continue
    for (const part of item.split(',')) wanted.add(part.trim().toUpperCase())
  }
  const regions = STATS_REGIONS.filter((r) => wanted.has(r))
  return regions.length > 0 ? regions : null
}

/** Exécute `fn` avec les régions de la requête stats (lues par les helpers SQL et le cache). */
export function runWithStatsRegion<T>(regions: StatsRegion[] | null, fn: () => T): T {
  return storage.run(regions && regions.length > 0 ? regions : null, fn)
}

export function currentStatsRegions(): StatsRegion[] | null {
  return storage.getStore() ?? null
}

/** Régions explicites (validées) sinon celles du contexte de requête. */
export function statsRegionsOr(explicit: unknown): StatsRegion[] | null {
  return regionParam(explicit) ?? currentStatsRegions()
}

/** `col = 'X'` ou `col IN ('X','Y')` ; null sans filtre. Valeurs issues de l'allowlist. */
export function regionInSql(column: string, regions: readonly StatsRegion[] | null): string | null {
  const valid = (regions ?? []).filter(isStatsRegion)
  if (valid.length === 0) return null
  if (valid.length === 1) return `${column} = '${valid[0]}'`
  return `${column} IN (${valid.map((r) => `'${r}'`).join(',')})`
}

/** Condition région du contexte sur `alias.region` (alias vide : `region`). */
export function regionSqlConditions(alias: string): string[] {
  const cond = regionInSql(`${alias ? `${alias}.` : ''}region`, currentStatsRegions())
  return cond ? [cond] : []
}

/** Préfixe de clé de cache par régions ; vide pour toutes les régions. */
export function regionCacheKey(): string {
  const regions = currentStatsRegions()
  return regions ? `r=${regions.join(',')}:` : ''
}

/**
 * Cache mémoire dont get/set/has portent sur la région de la requête.
 * Itération et delete gardent la clé complète (purge des entrées expirées).
 */
export class RegionScopedMap<V> extends Map<string, V> {
  override get(key: string): V | undefined {
    return super.get(regionCacheKey() + key)
  }

  override set(key: string, value: V): this {
    return super.set(regionCacheKey() + key, value)
  }

  override has(key: string): boolean {
    return super.has(regionCacheKey() + key)
  }
}
