import type { Champion, Item } from '@lelanation/shared-types'

export type TheorycraftAdaptiveStat = 'ad' | 'ap'

/** Choix adaptatif (runes / shards) : mage → AP, sinon comparaison AP/AD des items actifs. */
export function resolveTheorycraftAdaptiveStat(
  champion: Champion | null | undefined,
  items: readonly Item[]
): TheorycraftAdaptiveStat {
  const tags = champion?.tags ?? []
  if (tags.includes('Mage') || tags.includes('Support')) {
    const apFromItems = sumItemStat(items, 'FlatMagicDamageMod')
    const adFromItems = sumItemStat(items, 'FlatPhysicalDamageMod')
    if (apFromItems >= adFromItems) return 'ap'
  }
  const ap = sumItemStat(items, 'FlatMagicDamageMod')
  const ad = sumItemStat(items, 'FlatPhysicalDamageMod')
  return ap > ad ? 'ap' : 'ad'
}

function sumItemStat(items: readonly Item[], key: string): number {
  let total = 0
  for (const item of items) {
    const stats = item.stats as Record<string, number | undefined> | undefined
    total += stats?.[key] ?? 0
  }
  return total
}
