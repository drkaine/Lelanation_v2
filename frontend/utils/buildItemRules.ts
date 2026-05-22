import type { Item, Role, SummonerSpell } from '@lelanation/shared-types'

function isStarterItem(item: Item): boolean {
  return (item.tags ?? []).some(tag => tag.toLowerCase() === 'starter')
}

function isBootsItem(item: Item): boolean {
  return (item.tags ?? []).some(tag => tag.toLowerCase() === 'boots')
}

export const ATLAS_ITEM_ID = '3865'
export const SUPPORT_LINE_ITEM_IDS = new Set(['3866', '3867'])
export const ATLAS_UPGRADE_IDS = new Set(['3869', '3870', '3871', '3876', '3877'])
export const JUNGLE_PET_IDS = new Set(['1101', '1102', '1103'])
export const DEFAULT_JUNGLE_PET_ID = '1103'

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
  return SUPPORT_LINE_ITEM_IDS.has(item.id)
}

export function isAtlasStarter(item: Item): boolean {
  return item.id === ATLAS_ITEM_ID
}

export function isAtlasUpgradeItem(item: Item): boolean {
  return ATLAS_UPGRADE_IDS.has(item.id)
}

export function isJunglePetItem(item: Item): boolean {
  return JUNGLE_PET_IDS.has(item.id)
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

export function ensureSupportAtlasInItems(
  items: readonly Item[],
  lookup: (id: string) => Item | undefined
): Item[] {
  const { starterItems, bootsItems, coreItems } = bucketBuildItems(items)
  const supportLines = starterItems.filter(isSupportLineStarter)
  if (supportLines.length === 0) return [...items]

  const atlasFromBuild = starterItems.find(isAtlasStarter)
  const atlas = atlasFromBuild ?? lookup(ATLAS_ITEM_ID)
  if (!atlas) return [...items]

  const newStarters = [atlas, supportLines[0]!].slice(0, 2)
  return [...newStarters, ...bootsItems, ...stripStartersFromCore(coreItems)]
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
      newStarters = [greenPet, ...starterItems]
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
  let next = ensureSupportAtlasInItems(items, lookup)
  next = ensureJunglePetInItems(next, roles, lookup)
  return next
}

export function findSmiteSpell(spells: readonly SummonerSpell[]): SummonerSpell | undefined {
  return spells.find(spell => {
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
  })
}
