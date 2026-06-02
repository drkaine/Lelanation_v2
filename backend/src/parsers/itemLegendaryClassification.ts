import { isBootsTier2Or3ItemId } from './bootItemClassification.js'
import { getItemMetaLiteMap, hasItemMetaLite } from './itemMetaLite.js'
import { isStarterItemId } from './starterItemClassification.js'

const CONSUMABLE_IDS = new Set([2003, 2009, 2010, 2031, 2032, 2033, 2055, 2060])
const FORCED_LEGENDARY_IDS = new Set([2526])

/** Dernier tier (pas un composant intermédiaire) — inclut bottes T2/T3. */
export function isLegendaryCompleteItem(
  itemId: number,
  finalInventorySet?: ReadonlySet<number>,
): boolean {
  if (!Number.isFinite(itemId) || itemId <= 0) return false
  if (CONSUMABLE_IDS.has(itemId)) return false
  if (FORCED_LEGENDARY_IDS.has(itemId)) return true
  if (isBootsTier2Or3ItemId(itemId)) return true
  if (!hasItemMetaLite()) {
    return Boolean(
      finalInventorySet?.has(itemId) &&
        itemId !== 1001 &&
        !isStarterItemId(itemId),
    )
  }
  const item = getItemMetaLiteMap().get(itemId)
  if (!item) return false
  if (item.tags?.includes('Consumable')) return false
  if (item.id !== '1001' && item.tags?.includes('Boots')) return true
  if (item.isMasterwork) return true
  const hasFrom = Array.isArray(item.from) && item.from.length > 0
  const hasInto = Array.isArray(item.into) && item.into.length > 0
  return hasFrom && !hasInto
}
