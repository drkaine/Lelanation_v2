import type { ChampionSlugRef } from '~/utils/championSlug'
import { championStatsSegment } from '~/utils/championSlug'

/** Chemin i18n vers la fiche stats d’un champion (slug sémantique, ex. tristana). */
export function championStatsDetailPath(
  championId: number,
  localePath: (path: string) => string,
  champions?: ChampionSlugRef[]
): string {
  const segment = champions?.length
    ? championStatsSegment(championId, champions)
    : String(championId)
  return localePath(`/statistics/champion/${encodeURIComponent(segment)}`)
}

/** Lien fiche champion utilisable dès que l’id est connu (sans attendre gameVersion). */
export function championStatsDetailPathIfValid(
  championId: number,
  localePath: ((path: string) => string) | undefined,
  champions?: ChampionSlugRef[]
): string | null {
  if (!localePath || !Number.isFinite(championId) || championId <= 0) return null
  return championStatsDetailPath(championId, localePath, champions)
}
