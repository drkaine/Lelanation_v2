import { AsyncLocalStorage } from 'node:async_hooks'

/** Valeurs de l'enum Postgres `lol_region`. */
export const STATS_REGIONS = ['EUW1', 'EUN1', 'NA1', 'KR', 'BR1', 'LA1', 'LA2', 'OC1', 'TR1', 'JP1', 'ME1'] as const
export type StatsRegion = (typeof STATS_REGIONS)[number]

const ALLOWED: ReadonlySet<string> = new Set(STATS_REGIONS)
/** Filtre joueurs OTP (`?otp=`) : tous (somme des agrégats OTP et non OTP), sans OTP, OTP seuls. */
export type StatsOtpFilter = 'all' | 'exclude' | 'only'

interface StatsRequestScope {
  regions: StatsRegion[] | null
  otp: StatsOtpFilter
}

const storage = new AsyncLocalStorage<StatsRequestScope>()

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

/** `?otp=` : `exclude` ou `only` ; toute autre valeur = `all`. */
export function otpParam(value: unknown): StatsOtpFilter {
  const raw = Array.isArray(value) ? value[0] : value
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return v === 'exclude' || v === 'only' ? v : 'all'
}

/** Exécute `fn` avec les régions et le filtre OTP de la requête stats (lus par les helpers SQL et le cache). */
export function runWithStatsRegion<T>(
  regions: StatsRegion[] | null,
  fn: () => T,
  otp: StatsOtpFilter = 'all',
): T {
  return storage.run({ regions: regions && regions.length > 0 ? regions : null, otp }, fn)
}

export function currentStatsRegions(): StatsRegion[] | null {
  return storage.getStore()?.regions ?? null
}

export function currentStatsOtp(): StatsOtpFilter {
  return storage.getStore()?.otp ?? 'all'
}

/** Condition OTP du contexte sur `alias.otp` ; null pour `all`. */
export function otpSqlCondition(alias: string): string | null {
  const otp = currentStatsOtp()
  if (otp === 'all') return null
  return `${alias ? `${alias}.` : ''}otp = ${otp === 'only' ? 'true' : 'false'}`
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

/** Préfixe de clé de cache par régions et filtre OTP ; vide pour toutes les régions et tous les joueurs. */
export function regionCacheKey(): string {
  const regions = currentStatsRegions()
  const otp = currentStatsOtp()
  return `${regions ? `r=${regions.join(',')}:` : ''}${otp === 'all' ? '' : `otp=${otp}:`}`
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
