/** Chemin i18n vers la fiche stats d’un champion (id numérique Riot). */
export function championStatsDetailPath(
  championId: number,
  localePath: (path: string) => string
): string {
  return localePath(`/statistics/champion/${encodeURIComponent(String(championId))}`)
}

/** Lien fiche champion utilisable dès que l’id est connu (sans attendre gameVersion). */
export function championStatsDetailPathIfValid(
  championId: number,
  localePath: ((path: string) => string) | undefined
): string | null {
  if (!localePath || !Number.isFinite(championId) || championId <= 0) return null
  return championStatsDetailPath(championId, localePath)
}
