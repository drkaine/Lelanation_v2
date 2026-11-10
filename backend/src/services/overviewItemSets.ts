/** Trinkets + balise de contrôle (2055) : exclus des stats objets agrégées. */
export const OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS = new Set([3340, 3364, 3363, 2055])

/** Objets d'un set (bottes incluses), sans trinkets ni consommables exclus. */
export function overviewItemSetItems(listStr: string): number[] {
  return parseItemSetKeyString(listStr).filter(id => !OVERVIEW_DETAIL_EXCLUDED_ITEM_IDS.has(id))
}

export function parseItemSetKeyString(key: string): number[] {
  if (!key) return []
  const trimmed = key.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      }
    } catch {
      /* legacy JSON parse failed */
    }
  }
  return trimmed
    .split('_')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}
