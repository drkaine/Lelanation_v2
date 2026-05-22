import type { Item, Role, SummonerSpell } from '@lelanation/shared-types'

function itemId(item: Item): string {
  return String(item.id ?? '').trim()
}

const BOOT_IDS = new Set([
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

const STARTER_IDS = new Set([
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
  '3866',
  '3867',
  '2003',
  '2009',
  '2010',
  '2031',
  '2032',
  '2033',
  '2055',
  '1101',
  '1102',
  '1103',
])

const STARTER_NAME_PATTERNS = [
  'seau',
  'anneau de doran',
  'lame de doran',
  'bouclier de doran',
  'arc de doran',
  'casque de doran',
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
  'potion',
  'ward',
  'elixir',
  'biscuit',
]

function isStarterItem(item: Item): boolean {
  const id = itemId(item)
  if (ATLAS_UPGRADE_IDS.has(id)) return false
  if (STARTER_IDS.has(id)) return true
  const lower = (item.name ?? '').toLowerCase()
  return (
    STARTER_NAME_PATTERNS.some(p => lower.includes(p)) || Boolean(item.tags?.includes('Consumable'))
  )
}

function isBootsItem(item: Item): boolean {
  const id = itemId(item)
  if (item.tags?.includes('Boots')) return true
  if (BOOT_IDS.has(id)) return true
  if (item.from?.some(parentId => BOOT_IDS.has(String(parentId).trim()))) return true
  return false
}

export const ATLAS_ITEM_ID = '3865'
export const SUPPORT_LINE_ITEM_IDS = new Set(['3866', '3867'])
export const ATLAS_UPGRADE_IDS = new Set(['3869', '3870', '3871', '3876', '3877'])
export const JUNGLE_PET_IDS = new Set(['1101', '1102', '1103'])
export const DEFAULT_JUNGLE_PET_ID = '1103'

export function lookupCatalogItem(items: readonly Item[], id: string): Item | undefined {
  const normalizedId = String(id).trim()
  return items.find(candidate => itemId(candidate) === normalizedId)
}

export function bucketBuildItems(items: readonly Item[]) {
  const starterItems: Item[] = []
  const bootsItems: Item[] = []
  const coreItems: Item[] = []

  for (const item of items) {
    if (isStarterItem(item) && starterItems.length < 2) {
      starterItems.push(item)
      continue
    }
    if (isBootsItem(item) && !isStarterItem(item) && bootsItems.length < 2) {
      bootsItems.push(item)
      continue
    }
    coreItems.push(item)
  }

  return { starterItems, bootsItems, coreItems }
}

/** Retire les starters qui ont dépassé les 2 emplacements et atterri dans le core. */
function stripStartersFromCore(coreItems: readonly Item[]): Item[] {
  return coreItems.filter(item => !isStarterItem(item))
}

/**
 * Remplace le premier emplacement starter (désélectionne l'ancien, ne le pousse pas en core).
 * Conserve le 2ᵉ starter s'il existe.
 */
export function replaceFirstStarterInItems(items: readonly Item[], replacement: Item): Item[] {
  const { starterItems, bootsItems, coreItems } = bucketBuildItems(items)
  const newStarters: Item[] = [replacement]
  if (starterItems.length >= 2) {
    newStarters.push(starterItems[1]!)
  }
  return [...newStarters.slice(0, 2), ...bootsItems, ...stripStartersFromCore(coreItems)]
}

export function isSupportLineStarter(item: Item): boolean {
  return SUPPORT_LINE_ITEM_IDS.has(itemId(item))
}

export function isAtlasStarter(item: Item): boolean {
  return itemId(item) === ATLAS_ITEM_ID
}

export function isAtlasUpgradeItem(item: Item): boolean {
  return ATLAS_UPGRADE_IDS.has(itemId(item))
}

export function isJunglePetItem(item: Item): boolean {
  return JUNGLE_PET_IDS.has(itemId(item))
}

export function hasAtlasUpgradeInItems(items: readonly Item[]): boolean {
  return items.some(isAtlasUpgradeItem)
}

/** Support build must include an Atlas upgrade when a support starter line or Atlas is present. */
export function requiresAtlasUpgradeForBuild(
  items: readonly Item[],
  roles: readonly Role[] | null | undefined
): boolean {
  if (!roles?.includes('support')) return false
  const { starterItems } = bucketBuildItems(items)
  const hasSupportLine = starterItems.some(isSupportLineStarter)
  const hasAtlas = starterItems.some(isAtlasStarter)
  return hasSupportLine || hasAtlas
}

export function atlasUpgradeMissing(
  items: readonly Item[],
  roles: readonly Role[] | null | undefined
): boolean {
  return requiresAtlasUpgradeForBuild(items, roles) && !hasAtlasUpgradeInItems(items)
}

export function stripJunglePetFromItems(items: readonly Item[]): Item[] {
  const filtered = items.filter(item => !isJunglePetItem(item))
  const { starterItems, bootsItems, coreItems } = bucketBuildItems(filtered)
  return [...starterItems, ...bootsItems, ...stripStartersFromCore(coreItems)]
}

export function stripAtlasStarterFromItems(items: readonly Item[]): Item[] {
  const filtered = items.filter(item => !isAtlasStarter(item))
  const { starterItems, bootsItems, coreItems } = bucketBuildItems(filtered)
  return [...starterItems, ...bootsItems, ...stripStartersFromCore(coreItems)]
}

export function ensureSupportAtlasInItems(
  items: readonly Item[],
  roles: readonly Role[] | null | undefined,
  lookup: (id: string) => Item | undefined
): Item[] {
  if (!roles?.includes('support')) return [...items]

  const { starterItems, bootsItems, coreItems } = bucketBuildItems(items)
  const atlasFromBuild = starterItems.find(isAtlasStarter)
  const atlas = atlasFromBuild ?? lookup(ATLAS_ITEM_ID)
  if (!atlas) return [...items]

  const supportLines = starterItems.filter(isSupportLineStarter)
  const otherStarters = starterItems.filter(
    item => !isAtlasStarter(item) && !isSupportLineStarter(item)
  )

  let newStarters: Item[]
  if (supportLines.length > 0) {
    newStarters = [atlas, supportLines[0]!]
  } else if (otherStarters.length >= 2) {
    newStarters = [atlas, otherStarters[1]!]
  } else if (otherStarters.length === 1) {
    newStarters = atlasFromBuild ? [atlas, otherStarters[0]!] : [atlas]
  } else {
    newStarters = [atlas]
  }

  return [...newStarters.slice(0, 2), ...bootsItems, ...stripStartersFromCore(coreItems)]
}

export function ensureJunglePetInItems(
  items: readonly Item[],
  roles: readonly Role[] | null | undefined,
  lookup: (id: string) => Item | undefined
): Item[] {
  if (!roles?.includes('jungle')) return [...items]

  const greenPet = lookup(DEFAULT_JUNGLE_PET_ID)
  if (!greenPet) return [...items]

  const { starterItems, bootsItems, coreItems } = bucketBuildItems(items)
  const cleanedCore = stripStartersFromCore(coreItems)
  const petIndex = starterItems.findIndex(isJunglePetItem)

  let newStarters: Item[]
  if (petIndex === -1) {
    if (starterItems.length >= 2) {
      newStarters = [greenPet, starterItems[1]!]
    } else {
      newStarters = [greenPet]
    }
  } else {
    newStarters = [...starterItems]
    newStarters[petIndex] = greenPet
  }

  return [...newStarters.slice(0, 2), ...bootsItems, ...cleanedCore]
}

export function normalizeBuildItemsAfterChange(
  items: readonly Item[],
  roles: readonly Role[] | null | undefined,
  lookup: (id: string) => Item | undefined
): Item[] {
  let next = [...items]
  if (!roles?.includes('jungle')) {
    next = stripJunglePetFromItems(next)
  }
  if (!roles?.includes('support')) {
    next = stripAtlasStarterFromItems(next)
  }
  next = ensureSupportAtlasInItems(next, roles, lookup)
  next = ensureJunglePetInItems(next, roles, lookup)
  return next
}

export function isSmiteSpell(spell: SummonerSpell | null | undefined): boolean {
  if (!spell) return false
  const spellId = String(spell.id ?? '')
    .trim()
    .toLowerCase()
  const spellKey = String(spell.key ?? '')
    .trim()
    .toLowerCase()
  if (spellId === '11' || spellKey === '11') return true
  if (
    spellId === 'summonersmite' ||
    spellKey === 'summonersmite' ||
    spellId.includes('smite') ||
    spellKey.includes('smite')
  ) {
    return true
  }
  const name = (spell.name ?? '').toLowerCase().trim()
  return name.includes('smite') || name.includes('punition') || name.includes('châtiment')
}

export function findSmiteSpell(spells: readonly SummonerSpell[]): SummonerSpell | undefined {
  return spells.find(spell => isSmiteSpell(spell))
}

export function stripSmiteFromSummonerSpells(
  spells: [SummonerSpell | null, SummonerSpell | null] | null | undefined
): [SummonerSpell | null, SummonerSpell | null] {
  const next: [SummonerSpell | null, SummonerSpell | null] = [
    spells?.[0] ?? null,
    spells?.[1] ?? null,
  ]
  if (isSmiteSpell(next[0])) next[0] = null
  if (isSmiteSpell(next[1])) next[1] = null
  return next
}

export function applyJungleSmiteToSummonerSpells(
  spells: [SummonerSpell | null, SummonerSpell | null] | null | undefined,
  smite: SummonerSpell | undefined
): [SummonerSpell | null, SummonerSpell | null] {
  const next: [SummonerSpell | null, SummonerSpell | null] = [
    spells?.[0] ?? null,
    spells?.[1] ?? null,
  ]
  if (!smite) return next
  if (isSmiteSpell(next[0]) || isSmiteSpell(next[1])) return next
  next[0] = smite
  return next
}
