/** Chemin i18n vers la fiche stats d’un objet (id Data Dragon). */
export function itemStatsDetailPath(itemId: number, localePath: (path: string) => string): string {
  return localePath(`/statistics/item/${encodeURIComponent(String(itemId))}`)
}

export function itemStatsDetailPathIfValid(
  itemId: number,
  localePath: ((path: string) => string) | undefined
): string | null {
  if (!localePath || !Number.isFinite(itemId) || itemId <= 0) return null
  return itemStatsDetailPath(itemId, localePath)
}
