export function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(x => Number(x))
  const pb = b.split('.').map(x => Number(x))
  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const da = Number.isFinite(pa[i]) ? (pa[i] as number) : 0
    const db = Number.isFinite(pb[i]) ? (pb[i] as number) : 0
    if (da !== db) return db - da
  }
  return b.localeCompare(a)
}

/** Normalise une version (ex. "16.3.123") en préfixe pour l’API (ex. "16.3"). */
export function normalizeVersionToPrefix(v: string | null | undefined): string | null {
  if (!v || typeof v !== 'string') return null
  const parts = v.trim().split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return parts[0] || null
}

/**
 * Patch du filtre version des stats : le filtre courant s’il a des matchs, sinon `?version=` de l’URL
 * (le chargement des versions peut finir avant que la page applique la query), sinon le plus récent avec matchs.
 */
/** Un patch sous cette part du plus gros patch n'est pas comparable (ex. 93 parties vs 50 000). */
export const MIN_VERSION_SHARE = 0.05

export function pickStatsVersionFilter(input: {
  current: string
  queryVersion: string
  versions: ReadonlyArray<{ version: string; matchCount?: number | null }>
}): string {
  const { versions } = input
  if (!versions.length) return input.current
  const hasData = (v: string) =>
    v !== '' && versions.some(o => o.version === v && Number(o.matchCount ?? 0) > 0)
  const current = input.current.trim()
  if (hasData(current)) return current
  const fromQuery = input.queryVersion.trim()
  if (hasData(fromQuery)) return fromQuery
  const max = Math.max(0, ...versions.map(v => Number(v.matchCount ?? 0)))
  const enough = versions
    .filter(v => Number(v.matchCount ?? 0) > 0 && Number(v.matchCount) >= max * MIN_VERSION_SHARE)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
  return enough[0]?.version ?? versions[0]?.version ?? ''
}

export interface ThinPatchNotice {
  /** `selected` : le patch choisi est trop maigre ; `fallback` : le dernier patch l'est, on montre le précédent. */
  mode: 'selected' | 'fallback'
  thinVersion: string
  matchCount: number
  needed: number
  reliableVersion: string
}

/** Bandeau « nouveau patch » (maquette Vue d'ensemble) : patch trop récent pour des stats fiables. */
export function thinPatchNotice(input: {
  selected: string
  versions: ReadonlyArray<{ version: string; matchCount?: number | null }>
}): ThinPatchNotice | null {
  const withData = input.versions
    .filter(v => Number(v.matchCount ?? 0) > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
  const newest = withData[0]
  if (!newest) return null
  const max = Math.max(...withData.map(v => Number(v.matchCount)))
  const needed = Math.ceil(max * MIN_VERSION_SHARE)
  const isThin = (v: { matchCount?: number | null }) => Number(v.matchCount) < needed
  if (!isThin(newest)) return null
  const reliable = withData.find(v => !isThin(v))
  if (!reliable) return null
  const selected = input.selected.trim()
  const chosen = withData.find(v => v.version === selected)
  const mode =
    chosen && isThin(chosen)
      ? 'selected'
      : selected === '' || selected === reliable.version
        ? 'fallback'
        : null
  if (!mode) return null
  const thin = mode === 'selected' ? chosen! : newest
  return {
    mode,
    thinVersion: thin.version,
    matchCount: Number(thin.matchCount),
    needed,
    reliableVersion: reliable.version,
  }
}
