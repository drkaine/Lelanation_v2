import { getItemMetaLiteMap } from './itemMetaLite.js'

/** Bottes de base + T2 (fallback si metadata indisponible). */
export const BOOT_ITEM_IDS = new Set([
  1001, 3005, 3006, 3009, 3010, 3020, 3047, 3111, 3117, 3158,
])

function bootParentId(parentId: string): boolean {
  const n = Number(parentId)
  return parentId === '1001' || BOOT_ITEM_IDS.has(n)
}

/** Bottes T1 / T2 / T3 (enchantements, upgrades depuis T2, quêtes support). */
export function isBootsItemId(itemId: number): boolean {
  if (!Number.isFinite(itemId) || itemId <= 0) return false
  if (BOOT_ITEM_IDS.has(itemId)) return true
  const item = getItemMetaLiteMap().get(itemId)
  if (item?.tags?.includes('Boots')) return true
  if (item?.from?.some((p) => bootParentId(p))) return true
  return false
}

/** Exclut les bottes de base (1001) — stats T2/T3+. */
export function isBootsTier2Or3ItemId(itemId: number): boolean {
  if (itemId === 1001) return false
  return isBootsItemId(itemId)
}
