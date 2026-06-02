import type { ParsedItemDto } from '../dto/match.dto.js'
import { isLegendaryCompleteItem } from './itemLegendaryClassification.js'
import { getItemMetaLiteMap } from './itemMetaLite.js'
import { isStarterPurchase } from './starterItemClassification.js'

/** Composant intermédiaire (a des upgrades possibles) — hors séquence d'ordre. */
export function isComponentItemId(itemId: number): boolean {
  const item = getItemMetaLiteMap().get(itemId)
  if (!item) return false
  const hasFrom = Array.isArray(item.from) && item.from.length > 0
  const hasInto = Array.isArray(item.into) && item.into.length > 0
  return hasFrom && hasInto
}

/** Éligible à la séquence d'ordre d'achat : starters (5 min) + légendaires complets (pas composants). */
export function isItemOrderSnapshotEligible(itemId: number, timestampMs: number): boolean {
  if (isStarterPurchase(timestampMs, itemId)) return true
  if (isComponentItemId(itemId)) return false
  return isLegendaryCompleteItem(itemId)
}

/**
 * Position d'achat (1-based) parmi starters + légendaires uniquement, triés par premier achat.
 */
export function buildStarterLegendaryOrderByItemId(
  items: ParsedItemDto[],
): Map<number, number> {
  const firstTsByItem = new Map<number, number>()
  for (const row of items) {
    const itemId = Number(row.itemId ?? 0)
    if (!Number.isFinite(itemId) || itemId <= 0) continue
    const ts = Math.max(0, Math.trunc(Number(row.timestampMs ?? 0)))
    const prev = firstTsByItem.get(itemId)
    if (prev == null || ts < prev) firstTsByItem.set(itemId, ts)
  }

  const eligible = Array.from(firstTsByItem.entries()).filter(([itemId, ts]) =>
    isItemOrderSnapshotEligible(itemId, ts),
  )
  eligible.sort((a, b) => {
    if (a[1] !== b[1]) return a[1] - b[1]
    return a[0] - b[0]
  })

  const orderByItem = new Map<number, number>()
  eligible.forEach(([itemId], idx) => orderByItem.set(itemId, idx + 1))
  return orderByItem
}
