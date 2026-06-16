export type ChampionSlugRef = { id: string; key: string | number }

export function normalizeChampionSlug(riotId: string): string {
  return riotId.toLowerCase()
}

export function championStatsSegment(championId: number, champions: ChampionSlugRef[]): string {
  const champ = champions.find(c => String(c.key) === String(championId))
  return champ ? normalizeChampionSlug(champ.id) : String(championId)
}

/** Resolve route param (numeric key or slug) to Riot champion key. */
export function championKeyFromRouteParam(
  param: string,
  champions: ChampionSlugRef[]
): number | null {
  const raw = String(param ?? '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) {
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const slug = raw.toLowerCase()
  const champ = champions.find(c => normalizeChampionSlug(c.id) === slug)
  if (!champ) return null
  const key = parseInt(String(champ.key), 10)
  return Number.isFinite(key) && key > 0 ? key : null
}

export function isNumericChampionRouteParam(param: string): boolean {
  return /^\d+$/.test(String(param ?? '').trim())
}
