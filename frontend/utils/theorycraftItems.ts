import type { Item } from '@lelanation/shared-types'

export const MAX_ACTIVE_ITEMS = 6

function isStarterItem(item: Item): boolean {
  return (item.tags ?? []).some(tag => tag.toLowerCase() === 'starter')
}

function isBootsItem(item: Item): boolean {
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
