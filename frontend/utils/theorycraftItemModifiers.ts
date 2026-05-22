import type { CalculatedStats, Item } from '@lelanation/shared-types'

export type TheorycraftItemImageLookup = (itemId: string) => Pick<Item, 'image'> | null | undefined

export interface TheorycraftPercentModifier {
  itemIds: string[]
  stat: 'abilityPower' | 'attackDamage' | 'health'
  percent: number
  labelKey: string
}

export interface TheorycraftStackableItemConfig {
  itemIds: string[]
  labelKey: string
  maxStacks?: number
  unlimitedStacks?: boolean
  presetStacks?: number
  stackUnit: 'stacks' | 'mana' | 'glory'
  supportsTransform?: boolean
  transformThreshold?: number
}

export interface TheorycraftItemModifierLine {
  itemId: string
  label: string
  labelKey?: string
  detail: string
}

export interface TheorycraftItemModifierResult {
  stats: CalculatedStats
  lines: TheorycraftItemModifierLine[]
}

export const THEORYCRAFT_PERCENT_MODIFIERS: TheorycraftPercentModifier[] = [
  {
    itemIds: ['3089'],
    stat: 'abilityPower',
    percent: 0.3,
    labelKey: 'theorycraft.items.rabadonAp',
  },
]

export const THEORYCRAFT_STACKABLE_ITEMS: TheorycraftStackableItemConfig[] = [
  {
    itemIds: ['1082'],
    labelKey: 'theorycraft.items.darkSeal',
    maxStacks: 10,
    stackUnit: 'glory',
  },
  {
    itemIds: ['3041'],
    labelKey: 'theorycraft.items.mejai',
    maxStacks: 25,
    stackUnit: 'glory',
  },
  {
    itemIds: ['3084'],
    labelKey: 'theorycraft.items.heartsteel',
    unlimitedStacks: true,
    presetStacks: 150,
    stackUnit: 'stacks',
  },
  {
    itemIds: ['3070', '3003', '3004'],
    labelKey: 'theorycraft.items.tear',
    maxStacks: 360,
    stackUnit: 'mana',
    supportsTransform: true,
    transformThreshold: 360,
  },
]

/** Flat base stats for glory items when missing from build refs or excluded as starters (1082). */
const GLORY_ITEM_BASE_STATS: Record<string, { abilityPower?: number; health?: number }> = {
  '1082': { abilityPower: 15, health: 50 },
  '3041': { abilityPower: 20, health: 100 },
}

function applyGloryItemBaseStats(stats: CalculatedStats, item: Item): void {
  const base = GLORY_ITEM_BASE_STATS[item.id]
  if (!base) return

  if (item.id === '1082') {
    if (base.abilityPower) stats.abilityPower += base.abilityPower
    if (base.health) stats.health += base.health
    return
  }

  if (item.id !== '3041') return

  const itemStats = item.stats as Record<string, number | undefined> | undefined
  const hasCatalogBase =
    (itemStats?.FlatMagicDamageMod ?? 0) > 0 || (itemStats?.FlatHPPoolMod ?? 0) > 0
  if (hasCatalogBase) return

  if (base.abilityPower) stats.abilityPower += base.abilityPower
  if (base.health) stats.health += base.health
}

const HEARTSTEEL_ITEM_ID = '3084'
/** In-game: each proc grants 20% of bonus health (max HP − base HP at level). */
const HEARTSTEEL_BONUS_HEALTH_PERCENT = 0.2

function applyHeartsteelCompounding(
  stats: CalculatedStats,
  stacks: number,
  championBaseHealth: number
): number {
  if (stacks <= 0) return 0
  let health = stats.health
  let totalGain = 0
  for (let i = 0; i < stacks; i++) {
    const bonusHealth = Math.max(0, health - championBaseHealth)
    const gain = Math.round(bonusHealth * HEARTSTEEL_BONUS_HEALTH_PERCENT)
    if (gain <= 0) break
    health += gain
    totalGain += gain
  }
  stats.health = health
  return totalGain
}

const ITEM_FLAT_STATS: Record<
  string,
  { mana?: number; abilityPower?: number; attackDamage?: number }
> = {
  '3070': { mana: 240 },
  '3003': { mana: 600, abilityPower: 70 },
  '3004': { mana: 500, attackDamage: 35 },
}

const TRANSFORMED_ITEM_STATS: Record<
  string,
  { mana: number; abilityPower?: number; attackDamage?: number }
> = {
  '3070': { mana: 360 },
  '3003': { mana: 860, abilityPower: 80 },
  '3004': { mana: 860, attackDamage: 35 },
}

/** Item IDs affichés au verso T2 / stack max (Séraphin, Muramana…). */
const THEORYCRAFT_TRANSFORM_DISPLAY_ID: Record<string, string> = {
  '3003': '3040',
  '3004': '3042',
}

export function getTheorycraftTransformDisplayItemId(
  itemId: string,
  buildItemIds: readonly string[] = []
): string | null {
  const normalized = String(itemId)
  const direct = THEORYCRAFT_TRANSFORM_DISPLAY_ID[normalized]
  if (direct) return direct

  if (normalized !== '3070') return null

  const ids = new Set(buildItemIds.map(id => String(id)))
  if (ids.has('3004')) return '3042'
  if (ids.has('3003')) return '3040'
  return '3040'
}

export function shouldShowTheorycraftTransformedImage(
  itemId: string,
  stacks: number,
  transformed: boolean
): boolean {
  const config = getTheorycraftStackableItemConfig(itemId)
  if (!config?.supportsTransform) return false
  if (transformed) return true
  const threshold = config.transformThreshold ?? config.maxStacks
  return stacks >= threshold
}

export function resolveTheorycraftItemImageFull(
  item: Pick<Item, 'id' | 'image'>,
  options: {
    stacks: number
    transformed: boolean
    buildItemIds?: readonly string[]
  },
  lookupItem?: TheorycraftItemImageLookup
): string {
  const buildItemIds = options.buildItemIds ?? []
  if (!shouldShowTheorycraftTransformedImage(item.id, options.stacks, options.transformed)) {
    return item.image.full
  }

  const displayId = getTheorycraftTransformDisplayItemId(item.id, buildItemIds)
  if (!displayId) return item.image.full

  const resolved = lookupItem?.(displayId)
  if (resolved?.image?.full) return resolved.image.full

  return `${displayId}.png`
}

export function getTheorycraftStackableItemConfig(
  itemId: string
): TheorycraftStackableItemConfig | null {
  const normalized = String(itemId)
  return THEORYCRAFT_STACKABLE_ITEMS.find(config => config.itemIds.includes(normalized)) ?? null
}

export function isTheorycraftStackableItem(itemId: string): boolean {
  return getTheorycraftStackableItemConfig(itemId) != null
}

export function getTheorycraftPercentModifiersForItems(
  items: readonly Item[]
): TheorycraftPercentModifier[] {
  const ids = new Set(items.map(item => item.id))
  return THEORYCRAFT_PERCENT_MODIFIERS.filter(modifier =>
    modifier.itemIds.some(itemId => ids.has(itemId))
  )
}

function resolveItemStackCount(value: number, config: TheorycraftStackableItemConfig): number {
  if (!Number.isFinite(value)) return 0
  const safe = Math.max(0, Math.trunc(value))
  if (config.unlimitedStacks) return safe
  const max = config.maxStacks ?? 0
  if (max <= 0) return safe
  return Math.min(safe, max)
}

export function getTheorycraftItemStackStats(
  itemId: string,
  stacks: number
): Record<string, number> {
  const config = getTheorycraftStackableItemConfig(itemId)
  const count = config ? resolveItemStackCount(stacks, config) : Math.max(0, Math.trunc(stacks))
  switch (itemId) {
    case '1082':
    case '3041':
      return count > 0 ? { abilityPower: count * 5 } : {}
    case '3084':
      return {}
    case '3070':
    case '3003':
    case '3004':
      return count > 0 ? { mana: count } : {}
    default:
      return {}
  }
}

export function applyTheorycraftItemModifiers(args: {
  stats: CalculatedStats
  items: readonly Item[]
  itemStacksById: Record<string, number>
  transformedById: Record<string, boolean>
  labels: Record<string, string>
  /** Champion base HP at current level (for Heartsteel bonus-health ratio). */
  championBaseHealth?: number
}): TheorycraftItemModifierResult {
  const { items, itemStacksById, transformedById, labels, championBaseHealth } = args
  const stats: CalculatedStats = { ...args.stats }
  const lines: TheorycraftItemModifierLine[] = []

  for (const item of items) {
    const config = getTheorycraftStackableItemConfig(item.id)
    if (!config) continue

    applyGloryItemBaseStats(stats, item)

    const stacks = resolveItemStackCount(itemStacksById[item.id] ?? 0, config)
    const transformed = Boolean(transformedById[item.id])
    const label = labels[config.labelKey] ?? item.name

    if (transformed && config.supportsTransform) {
      const base = ITEM_FLAT_STATS[item.id]
      const upgraded = TRANSFORMED_ITEM_STATS[item.id]
      if (base && upgraded) {
        if (upgraded.mana != null && base.mana != null) stats.mana += upgraded.mana - base.mana
        if (upgraded.abilityPower != null && base.abilityPower != null) {
          stats.abilityPower += upgraded.abilityPower - base.abilityPower
        }
        if (upgraded.attackDamage != null && base.attackDamage != null) {
          stats.attackDamage += upgraded.attackDamage - base.attackDamage
        }
      }
      lines.push({
        itemId: item.id,
        label,
        labelKey: config.labelKey,
        detail: labels['theorycraft.items.transformed'] ?? 'Transformed',
      })
      continue
    }

    if (stacks <= 0) continue

    if (item.id === HEARTSTEEL_ITEM_ID) continue

    const bonus = getTheorycraftItemStackStats(item.id, stacks)
    if (bonus.mana) stats.mana += bonus.mana
    if (bonus.health) stats.health += bonus.health
    if (bonus.abilityPower) stats.abilityPower += bonus.abilityPower

    lines.push({
      itemId: item.id,
      label,
      labelKey: config.labelKey,
      detail: `+${stacks} ${config.stackUnit}`,
    })
  }

  const hasArchangelLine = items.some(item => item.id === '3003' || item.id === '3070')
  if (hasArchangelLine) {
    const aweAp = Math.round(stats.mana * 0.01 * 10) / 10
    if (aweAp > 0) {
      stats.abilityPower += aweAp
      lines.push({
        itemId: '3003',
        label: labels['theorycraft.items.archangelAwe'] ?? 'Awe (AP)',
        labelKey: 'theorycraft.items.archangelAwe',
        detail: `+${aweAp} AP`,
      })
    }
  }

  if (items.some(item => item.id === '3004')) {
    const aweAd = Math.round(stats.mana * 0.025 * 10) / 10
    if (aweAd > 0) {
      stats.attackDamage += aweAd
      lines.push({
        itemId: '3004',
        label: labels['theorycraft.items.manamuneAwe'] ?? 'Awe (AD)',
        labelKey: 'theorycraft.items.manamuneAwe',
        detail: `+${aweAd} AD`,
      })
    }
  }

  for (const modifier of getTheorycraftPercentModifiersForItems(items)) {
    const before = stats[modifier.stat]
    const bonus = before * modifier.percent
    if (bonus <= 0) continue
    stats[modifier.stat] = before + bonus
    lines.push({
      itemId: modifier.itemIds[0] ?? '',
      label: labels[modifier.labelKey] ?? modifier.stat,
      labelKey: modifier.labelKey,
      detail: `+${Math.round(bonus * 10) / 10} (${Math.round(modifier.percent * 100)}%)`,
    })
  }

  const heartsteelItem = items.find(item => item.id === HEARTSTEEL_ITEM_ID)
  if (heartsteelItem && championBaseHealth != null && championBaseHealth > 0) {
    const config = getTheorycraftStackableItemConfig(HEARTSTEEL_ITEM_ID)
    const stacks = config
      ? resolveItemStackCount(itemStacksById[HEARTSTEEL_ITEM_ID] ?? 0, config)
      : Math.max(0, Math.trunc(itemStacksById[HEARTSTEEL_ITEM_ID] ?? 0))
    if (stacks > 0) {
      const gain = applyHeartsteelCompounding(stats, stacks, championBaseHealth)
      if (gain > 0) {
        lines.push({
          itemId: HEARTSTEEL_ITEM_ID,
          label: labels['theorycraft.items.heartsteel'] ?? heartsteelItem.name,
          labelKey: 'theorycraft.items.heartsteel',
          detail: `+${stacks} stacks (+${gain} PV, 20% bonus HP/stack)`,
        })
      }
    }
  }

  return { stats, lines }
}

export function remapTheorycraftItemStacksByIndex<T>(
  previousItems: readonly Item[],
  nextItems: readonly Item[],
  record: Record<number, T>
): Record<number, T> {
  const out: Record<number, T> = {}
  for (const [indexStr, value] of Object.entries(record)) {
    const prevIndex = Number(indexStr)
    const itemId = previousItems[prevIndex]?.id
    if (!itemId) continue
    const nextIndex = nextItems.findIndex(item => item.id === itemId)
    if (nextIndex >= 0) out[nextIndex] = value
  }
  return out
}
