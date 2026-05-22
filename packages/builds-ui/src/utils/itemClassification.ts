import type { Item } from '@lelanation/shared-types'

const BOOT_IDS = new Set([
  '1001', '3005', '3006', '3009', '3010',
  '3020', '3047', '3111', '3117', '3158',
])

export function isBootsItem(item: Item): boolean {
  const id = String(item.id ?? '').trim()
  if (item.tags?.includes('Boots')) return true
  if (BOOT_IDS.has(id)) return true
  if (item.from?.some(parentId => BOOT_IDS.has(String(parentId).trim()))) return true
  return false
}

const STARTER_IDS = new Set([
  '1036', '1054', '1055', '1056', '1082', '1083', '3070', '1086', '1087',
  '3865', '3866', '3867', '2003', '2009', '2010',
  '2031', '2032', '2033', '2055', '1101', '1102', '1103',
])

const STARTER_NAME_PATTERNS = [
  'seau', 'anneau de doran', 'lame de doran', 'bouclier de doran',
  'arc de doran', 'casque de doran',
  "doran's arc", "doran's helm",
  'larme de la déesse', 'cull', 'abatteur', 'atlas', 'épée de voleur',
  'épée longue', 'long sword', 'faucheuse', 'fragment',
  'potion', 'ward', 'elixir', 'biscuit',
]

const ATLAS_UPGRADE_IDS = new Set(['3869', '3870', '3871', '3876', '3877'])

export function isStarterItem(item: Item): boolean {
  const id = String(item.id ?? '').trim()
  if (ATLAS_UPGRADE_IDS.has(id)) return false
  if (STARTER_IDS.has(id)) return true
  const lower = (item.name ?? '').toLowerCase()
  return (
    STARTER_NAME_PATTERNS.some(p => lower.includes(p)) ||
    Boolean(item.tags?.includes('Consumable'))
  )
}
