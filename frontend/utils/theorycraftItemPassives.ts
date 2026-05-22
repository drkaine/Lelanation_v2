import type { CalculatedStats, Champion, Item } from '@lelanation/shared-types'
import { resolveChampionStatsForBuild } from './theorycraftStats'
import { isTheorycraftItemWithProc, THEORYCRAFT_ITEM_PROCS } from './theorycraftItemProcs'

export type TheorycraftItemPassiveKind = 'stat' | 'proc'

export interface TheorycraftItemPassiveConfig {
  itemIds: string[]
  labelKey: string
  kind: TheorycraftItemPassiveKind
}

export interface TheorycraftItemPassiveLine {
  itemId: string
  label: string
  labelKey?: string
  detail: string
}

export interface TheorycraftItemPassiveResult {
  stats: CalculatedStats
  lines: TheorycraftItemPassiveLine[]
}

const STAT_PASSIVE_CONFIGS: TheorycraftItemPassiveConfig[] = [
  {
    itemIds: ['6665'],
    labelKey: 'theorycraft.items.passiveJaksho',
    kind: 'stat',
  },
]

export function getTheorycraftActivatableItemPassiveConfig(
  itemId: string
): TheorycraftItemPassiveConfig | null {
  const normalized = String(itemId)
  const stat = STAT_PASSIVE_CONFIGS.find(config => config.itemIds.includes(normalized))
  if (stat) return stat

  const proc = THEORYCRAFT_ITEM_PROCS.find(config => config.itemIds.includes(normalized))
  if (proc) {
    return { itemIds: [normalized], labelKey: proc.labelKey, kind: 'proc' }
  }
  return null
}

export function isTheorycraftActivatableItemPassive(itemId: string): boolean {
  return getTheorycraftActivatableItemPassiveConfig(itemId) != null
}

function baseResistsAtLevel(
  champion: Champion,
  level: number
): { armor: number; magicResist: number } {
  const stats = resolveChampionStatsForBuild(champion)
  if (!stats) return { armor: 0, magicResist: 0 }
  const mult = Math.max(0, level - 1)
  const safe = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    armor: safe(stats.armor) + safe(stats.armorperlevel) * mult,
    magicResist: safe(stats.spellblock) + safe(stats.spellblockperlevel) * mult,
  }
}

function applyJakshoPassive(
  stats: CalculatedStats,
  champion: Champion,
  level: number
): { armor: number; magicResist: number } {
  const base = baseResistsAtLevel(champion, level)
  const bonusArmor = Math.max(0, stats.armor - base.armor)
  const bonusMr = Math.max(0, stats.magicResist - base.magicResist)
  return {
    armor: Math.round(bonusArmor * 0.3 * 10) / 10,
    magicResist: Math.round(bonusMr * 0.3 * 10) / 10,
  }
}

export function isTheorycraftItemPassiveActive(
  itemIndex: number,
  itemId: string,
  activeByIndex: Record<number, boolean>
): boolean {
  if (!isTheorycraftActivatableItemPassive(itemId)) return true
  return Boolean(activeByIndex[itemIndex])
}

export function applyTheorycraftItemPassives(args: {
  stats: CalculatedStats
  champion: Champion
  level: number
  itemsWithIndex: readonly { index: number; item: Item }[]
  activeByIndex: Record<number, boolean>
  labels: Record<string, string>
}): TheorycraftItemPassiveResult {
  const stats: CalculatedStats = { ...args.stats }
  const lines: TheorycraftItemPassiveLine[] = []

  for (const { index, item } of args.itemsWithIndex) {
    if (!isTheorycraftItemPassiveActive(index, item.id, args.activeByIndex)) continue

    const config = getTheorycraftActivatableItemPassiveConfig(item.id)
    if (!config || config.kind !== 'stat') continue

    if (item.id === '6665') {
      const bonus = applyJakshoPassive(stats, args.champion, args.level)
      if (bonus.armor > 0) stats.armor += bonus.armor
      if (bonus.magicResist > 0) stats.magicResist += bonus.magicResist
      if (bonus.armor > 0 || bonus.magicResist > 0) {
        lines.push({
          itemId: item.id,
          label: args.labels[config.labelKey] ?? item.name,
          labelKey: config.labelKey,
          detail: `+${bonus.armor} armure / +${bonus.magicResist} RM (30% bonus)`,
        })
      }
    }
  }

  return { stats, lines }
}

export function shouldIncludeItemProc(
  itemIndex: number,
  itemId: string,
  activeByIndex: Record<number, boolean>
): boolean {
  if (!isTheorycraftItemWithProc(itemId)) return false
  return isTheorycraftItemPassiveActive(itemIndex, itemId, activeByIndex)
}
