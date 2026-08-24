import type { Item } from '../types/build'
import { getItemShopIntoIds } from './itemShopEvolutions'
import { matchesItemSearch } from './multilingualEntitySearch'

export type ItemShopCategory = 'starter' | 'boots' | 'basic' | 'epic' | 'legendary' | 'other'

export type ItemShopRoleId =
  | 'all'
  | 'fighter'
  | 'marksman'
  | 'assassin'
  | 'mage'
  | 'tank'
  | 'support'

export const ITEM_SHOP_ROLE_ORDER: ItemShopRoleId[] = [
  'all',
  'fighter',
  'marksman',
  'assassin',
  'mage',
  'tank',
  'support',
]

/** Role presets inspired by lolshop.gg — item must match at least one tag. */
export const ITEM_SHOP_ROLE_TAGS: Record<Exclude<ItemShopRoleId, 'all'>, string[]> = {
  fighter: ['Damage', 'Health', 'Armor', 'LifeSteal', 'AbilityHaste', 'Omnivamp'],
  marksman: ['Damage', 'CriticalStrike', 'AttackSpeed', 'OnHit', 'LifeSteal'],
  assassin: ['Damage', 'ArmorPenetration', 'AbilityHaste', 'LifeSteal'],
  mage: ['AbilityPower', 'Mana', 'MagicPenetration', 'AbilityHaste'],
  tank: ['Health', 'Armor', 'MagicResist', 'AbilityHaste'],
  support: ['AbilityHaste', 'Health', 'Mana', 'Armor', 'MagicResist'],
}

export const ITEM_SHOP_ALLOWED_TAGS = [
  'Damage',
  'CriticalStrike',
  'AttackSpeed',
  'OnHit',
  'ArmorPenetration',
  'AbilityPower',
  'Mana',
  'MagicPenetration',
  'Health',
  'Armor',
  'MagicResist',
  'AbilityHaste',
  'NonbootsMovement',
  'LifeSteal',
  'Omnivamp',
] as const

const TAG_ALIASES: Record<string, string[]> = {
  AbilityPower: ['AbilityPower', 'SpellDamage'],
}

export const ITEM_SHOP_CATEGORY_ORDER: Record<ItemShopCategory, number> = {
  starter: 1,
  boots: 2,
  basic: 3,
  epic: 4,
  legendary: 5,
  other: 6,
}

export const ITEM_SHOP_CATEGORY_LEGENDARY_FIRST_ORDER: Record<ItemShopCategory, number> = {
  legendary: 1,
  epic: 2,
  basic: 3,
  boots: 4,
  starter: 5,
  other: 6,
}

export type ItemShopCategorySortMode = 'legendary-first' | 'classic'

export function getCategoryDisplayOrder(mode: ItemShopCategorySortMode): ItemShopCategory[] {
  const order =
    mode === 'classic' ? ITEM_SHOP_CATEGORY_ORDER : ITEM_SHOP_CATEGORY_LEGENDARY_FIRST_ORDER
  return (Object.keys(order) as ItemShopCategory[]).sort((a, b) => order[a] - order[b])
}

export function getTagVariants(tag: string): string[] {
  return TAG_ALIASES[tag] ?? [tag]
}

export function itemHasTag(item: Item, tag: string): boolean {
  if (!item.tags?.length) return false
  return getTagVariants(tag).some(variant => item.tags!.includes(variant))
}

export function itemMatchesRole(item: Item, role: ItemShopRoleId): boolean {
  if (role === 'all') return true
  const tags = ITEM_SHOP_ROLE_TAGS[role]
  return tags.some(tag => itemHasTag(item, tag))
}

export function getItemShopCategory(item: Item): ItemShopCategory {
  const starterItemIds = new Set([
    '1036',
    '1054',
    '1055',
    '1056',
    '1082',
    '1083',
    '3070',
    '1086',
    '1087',
    '3865',
    '1101',
    '1102',
    '1103',
  ])

  const starterNamePatterns = [
    'seau',
    'dark seal',
    'anneau de doran',
    'lame de doran',
    'bouclier de doran',
    'arc de doran',
    'casque de doran',
    "doran's ring",
    "doran's blade",
    "doran's shield",
    "doran's arc",
    "doran's helm",
    'larme de la déesse',
    'cull',
    'abatteur',
    'atlas',
    'épée de voleur',
    'épée longue',
    'long sword',
    'faucheuse',
    'fragment',
    'arc de doran',
    'casque de doran',
  ]

  if (starterItemIds.has(item.id)) return 'starter'

  const itemNameLower = item.name.toLowerCase()
  if (starterNamePatterns.some(pattern => itemNameLower.includes(pattern))) return 'starter'

  if (item.tags?.includes('Boots')) return 'boots'

  const bootIds = new Set([
    '1001',
    '3005',
    '3006',
    '3009',
    '3010',
    '3020',
    '3047',
    '3111',
    '3117',
    '3158',
  ])

  if (bootIds.has(item.id)) return 'boots'
  if (item.from?.some(parentId => bootIds.has(parentId))) return 'boots'

  if (item.tags?.includes('Consumable')) {
    const consumableIds = new Set([
      '2003',
      '2009',
      '2010',
      '2031',
      '2032',
      '2033',
      '2055',
      '2060',
      '2061',
    ])
    const consumablePatterns = ['potion', 'ward', 'biscuit', 'elixir']
    if (
      consumableIds.has(item.id) ||
      consumablePatterns.some(pattern => itemNameLower.includes(pattern))
    ) {
      return 'starter'
    }
  }

  if (!item.from?.length) return 'basic'

  if ((item as Item & { isMasterwork?: boolean }).isMasterwork) return 'legendary'

  const forcedLegendaryIds = new Set(['2526'])
  if (forcedLegendaryIds.has(item.id)) return 'legendary'

  const intoIds = getItemShopIntoIds(item)
  if (item.from.length > 0 && intoIds.length) return 'epic'
  if (item.from.length > 0 && !intoIds.length) return 'legendary'

  return 'other'
}

export function sortItemsForShop(items: Item[]): Item[] {
  return sortShopItemsByCategoryMode(items, 'classic')
}

export function sortShopItemsByCategoryMode(items: Item[], mode: ItemShopCategorySortMode): Item[] {
  const order =
    mode === 'classic' ? ITEM_SHOP_CATEGORY_ORDER : ITEM_SHOP_CATEGORY_LEGENDARY_FIRST_ORDER
  return [...items].sort((a, b) => {
    const categoryDiff = order[getItemShopCategory(a)] - order[getItemShopCategory(b)]
    if (categoryDiff !== 0) return categoryDiff
    return (a.gold?.total ?? 0) - (b.gold?.total ?? 0)
  })
}

export function groupItemsByCategory(items: Item[]): Record<ItemShopCategory, Item[]> {
  const grouped: Record<ItemShopCategory, Item[]> = {
    starter: [],
    boots: [],
    basic: [],
    epic: [],
    legendary: [],
    other: [],
  }

  for (const item of sortItemsForShop(items)) {
    grouped[getItemShopCategory(item)].push(item)
  }

  return grouped
}

export function filterShopItems(options: {
  items: Item[]
  searchQuery?: string
  selectedTags?: string[]
  role?: ItemShopRoleId
  excludeMasterwork?: boolean
}): Item[] {
  const {
    items,
    searchQuery = '',
    selectedTags = [],
    role = 'all',
    excludeMasterwork = true,
  } = options

  let filtered = [...items]

  if (excludeMasterwork) {
    filtered = filtered.filter(item => !(item as Item & { isMasterwork?: boolean }).isMasterwork)
  }

  if (role !== 'all') {
    filtered = filtered.filter(item => itemMatchesRole(item, role))
  }

  if (selectedTags.length > 0) {
    filtered = filtered.filter(item => selectedTags.every(tag => itemHasTag(item, tag)))
  }

  const searchTerm = searchQuery.trim()
  if (searchTerm) {
    filtered = filtered.filter(item =>
      matchesItemSearch(searchTerm, {
        id: item.id,
        name: item.name,
        colloq: item.colloq,
        plaintext: item.plaintext,
      })
    )
  }

  return filtered
}

export function resolveShopItemsByIds(items: Item[], ids?: string[]): Item[] {
  if (!ids?.length) return []
  const byId = new Map(items.map(item => [item.id, item]))
  return ids.map(id => byId.get(id)).filter((item): item is Item => Boolean(item))
}

export function resolveItemShopBuildInto(item: Item | null | undefined, items: Item[]): Item[] {
  if (!item) return []
  return resolveShopItemsByIds(items, getItemShopIntoIds(item))
}

export function translateItemTag(tag: string, t: (key: string) => string): string {
  const tagMap: Record<string, string> = {
    Damage: 'damage',
    CriticalStrike: 'critical-strike',
    AttackSpeed: 'attack-speed',
    OnHit: 'on-hit',
    ArmorPenetration: 'armor-penetration',
    AbilityPower: 'ability-power',
    Mana: 'mana',
    MagicPenetration: 'magic-penetration',
    Health: 'health',
    Armor: 'armor',
    MagicResist: 'magic-resist',
    AbilityHaste: 'ability-haste',
    NonbootsMovement: 'movement',
    LifeSteal: 'life-steal',
    Omnivamp: 'omnivamp',
    OrnnUpgrade: 'ornn-upgrade',
  }

  const tagKey = tagMap[tag]
  if (!tagKey) {
    return tag
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, str => str.toUpperCase())
  }

  const translation = t(`item.${tagKey}`)
  if (translation === `item.${tagKey}`) {
    return tag
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^./, str => str.toUpperCase())
  }
  return translation
}
