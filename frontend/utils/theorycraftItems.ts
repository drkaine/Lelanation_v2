import type { Item } from '@lelanation/shared-types'

export const MAX_ACTIVE_ITEMS = 6

/** Merge build item refs with catalog entries so stat calculation sees Data Dragon stats. */
export function mergeItemWithCatalog(item: Item, catalogItem: Item | undefined): Item {
  if (!catalogItem) return item
  return {
    ...catalogItem,
    ...item,
    stats: catalogItem.stats ?? item.stats,
    gold: catalogItem.gold ?? item.gold,
    image: item.image?.full ? item.image : catalogItem.image,
    tags: catalogItem.tags ?? item.tags,
    name: catalogItem.name ?? item.name,
  }
}

export function resolveBuildItemsWithCatalog(
  items: readonly Item[],
  lookup: (id: string) => Item | undefined
): Item[] {
  return items.map(item => mergeItemWithCatalog(item, lookup(item.id)))
}

export function isStarterItem(item: Item): boolean {
  return (item.tags ?? []).some(tag => tag.toLowerCase() === 'starter')
}

export function isBootsItem(item: Item): boolean {
  return (item.tags ?? []).some(tag => tag.toLowerCase() === 'boots')
}

export function isAdcRole(roles: readonly string[] | null | undefined): boolean {
  return roles?.includes('adc') ?? false
}

export function countActiveNonStarterItems(
  items: readonly Item[],
  disabledIndices: ReadonlySet<number>
): { nonBoots: number; boots: number; total: number } {
  let nonBoots = 0
  let boots = 0

  items.forEach((item, index) => {
    if (disabledIndices.has(index) || isStarterItem(item)) return
    if (isBootsItem(item)) boots += 1
    else nonBoots += 1
  })

  return { nonBoots, boots, total: nonBoots + boots }
}

export function isWithinActiveItemLimit(
  items: readonly Item[],
  disabledIndices: ReadonlySet<number>,
  roles: readonly string[] | null | undefined
): boolean {
  const { nonBoots, total } = countActiveNonStarterItems(items, disabledIndices)
  if (isAdcRole(roles)) return nonBoots <= MAX_ACTIVE_ITEMS
  return total <= MAX_ACTIVE_ITEMS
}

export function filterItemsForTheorycraftStats(
  items: readonly Item[],
  disabledIndices: ReadonlySet<number>
): Item[] {
  return items.filter((_, index) => !disabledIndices.has(index))
}

/** Active items for stat totals: 6 slots (boots included except ADC: 6 core + 1 boot). */
export function selectTheorycraftItemsForStats(
  items: readonly Item[],
  disabledIndices: ReadonlySet<number>,
  roles: readonly string[] | null | undefined
): Item[] {
  const starters: Item[] = []
  const nonStartersInOrder: Item[] = []

  items.forEach((item, index) => {
    if (disabledIndices.has(index)) return
    if (isStarterItem(item)) starters.push(item)
    else nonStartersInOrder.push(item)
  })

  if (isAdcRole(roles)) {
    const nonBoots: Item[] = []
    const boots: Item[] = []
    for (const item of nonStartersInOrder) {
      if (isBootsItem(item)) boots.push(item)
      else nonBoots.push(item)
    }
    const limitedCore = nonBoots.slice(0, MAX_ACTIVE_ITEMS)
    const bootForStats = boots.length > 0 ? [boots[0]!] : []
    return [...starters, ...limitedCore, ...bootForStats]
  }

  const limitedNonStarters = nonStartersInOrder.slice(0, MAX_ACTIVE_ITEMS)
  return [...starters, ...limitedNonStarters]
}

export function activeItemLimitLabel(
  items: readonly Item[],
  disabledIndices: ReadonlySet<number>,
  roles: readonly string[] | null | undefined
): string {
  const { nonBoots, total } = countActiveNonStarterItems(items, disabledIndices)
  if (isAdcRole(roles)) return `${nonBoots}/${MAX_ACTIVE_ITEMS} + boots`
  return `${total}/${MAX_ACTIVE_ITEMS}`
}

export function clampDisabledIndicesToActiveLimit(
  items: readonly Item[],
  disabledIndices: ReadonlySet<number>,
  roles: readonly string[] | null | undefined
): number[] {
  const disabled = new Set(disabledIndices)
  if (isWithinActiveItemLimit(items, disabled, roles)) {
    return Array.from(disabled)
  }

  while (!isWithinActiveItemLimit(items, disabled, roles)) {
    let indexToDisable = -1
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (disabled.has(index)) continue
      const item = items[index]
      if (!item || isStarterItem(item)) continue
      indexToDisable = index
      break
    }
    if (indexToDisable < 0) break
    disabled.add(indexToDisable)
  }

  return Array.from(disabled)
}

export function remapDisabledItemIndices(
  previousItems: readonly Item[],
  nextItems: readonly Item[],
  disabledIndices: readonly number[]
): number[] {
  if (disabledIndices.length === 0) return []
  const disabledIds = new Set(
    disabledIndices.map(index => previousItems[index]?.id).filter((id): id is string => Boolean(id))
  )
  return nextItems
    .map((item, index) => (disabledIds.has(item.id) ? index : -1))
    .filter(index => index >= 0)
}
