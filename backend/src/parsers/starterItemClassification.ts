/** Achats « départ de lane » : fenêtre 5 min (Riot timeline ms depuis game start). */
export const STARTER_PURCHASE_WINDOW_MS = 5 * 60 * 1000

type StarterItemMeta = {
  name?: string
  tags?: string[]
}

const STARTER_IDS = new Set([
  '1036', '1054', '1055', '1056', '1082', '1083', '3070',
  '3865', '3866', '3867', '2003', '2009', '2010',
  '2031', '2032', '2033', '1101', '1102', '1103',
])
const ATLAS_UPGRADE_IDS = new Set(['3869', '3870', '3871', '3876', '3877'])
const CONSUMABLE_IDS = new Set(['2003', '2009', '2010', '2031', '2032', '2033', '2055', '2060'])
const STARTER_PATTERNS = [
  'seau', 'anneau de doran', 'lame de doran', 'bouclier de doran',
  'arc de doran', 'casque de doran',
  "doran's ring", "doran's blade", "doran's shield", "doran's arc", "doran's helm",
  'larme de la deesse', 'cull', 'abatteur', 'atlas', 'epee de voleur',
  'epee longue', 'long sword', 'faucheuse', 'fragment',
  'potion', 'ward', 'biscuit',
]

function normalizeText(input: string | undefined): string {
  return (input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Objet d'achat initial (Doran, potions, pets, etc.) — pas un core/légendaire acheté tôt avec l'or farmé.
 */
export function isStarterItemId(itemId: number, itemMeta?: StarterItemMeta): boolean {
  const id = String(itemId)
  if (ATLAS_UPGRADE_IDS.has(id)) return false
  if (itemId === 2055) return false
  if (STARTER_IDS.has(id) || CONSUMABLE_IDS.has(id)) return true
  if (itemMeta?.tags?.includes('Consumable')) return true
  const lower = normalizeText(itemMeta?.name)
  return STARTER_PATTERNS.some((p) => lower.includes(p))
}

export function isStarterPurchase(timestampMs: number, itemId: number, itemMeta?: StarterItemMeta): boolean {
  return timestampMs < STARTER_PURCHASE_WINDOW_MS && isStarterItemId(itemId, itemMeta)
}
