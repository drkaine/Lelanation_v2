import { isBootsTier2Or3ItemId } from './bootItemClassification.js'
import { isLegendaryCompleteItem } from './itemLegendaryClassification.js'
import { isStarterPurchase } from './starterItemClassification.js'

const CONSUMABLE_IDS = new Set([2003, 2009, 2010, 2031, 2032, 2033, 2055, 2060, 2138, 2139, 2140])
const CORE_LEGENDARY_COUNT = 3

export type ItemSetKeys = { starterKey: string; coreKey: string; bootsKey: string; finalKey: string }

function serialize(ids: number[]): string {
  return [...new Set(ids)].sort((a, b) => a - b).join('_')
}

/**
 * Clés de sets d'un participant à partir de son historique d'achats (1er achat par objet).
 * starter = achats de départ (sans consommable), core = 3 premiers légendaires,
 * final = starter + bottes T2/T3 + core. Les composants n'entrent dans aucune clé.
 */
export function itemSetKeysFromHistory(
  history: ReadonlyArray<{ itemId: number; timestampMs: number }>,
): ItemSetKeys {
  const sorted = [...history].sort((a, b) => a.timestampMs - b.timestampMs)
  const starter = sorted
    .filter((i) => !CONSUMABLE_IDS.has(i.itemId) && isStarterPurchase(i.timestampMs, i.itemId))
    .map((i) => i.itemId)
  const boots = sorted.filter((i) => isBootsTier2Or3ItemId(i.itemId)).map((i) => i.itemId)
  const core = [
    ...new Set(
      sorted
        .filter((i) => !isBootsTier2Or3ItemId(i.itemId) && isLegendaryCompleteItem(i.itemId))
        .map((i) => i.itemId),
    ),
  ].slice(0, CORE_LEGENDARY_COUNT)
  const finalKey = core.length > 0 ? serialize([...starter, ...boots.slice(0, 1), ...core]) : ''
  return {
    starterKey: serialize(starter),
    coreKey: serialize(core),
    bootsKey: serialize(boots),
    finalKey,
  }
}
