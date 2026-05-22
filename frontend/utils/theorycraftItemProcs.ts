import type { Item } from '@lelanation/shared-types'
import type { TheorycraftBuildStats } from '~/types/theorycraft'

export type TheorycraftProcDamageType = 'physical' | 'magic' | 'true'

export interface TheorycraftItemProcLine {
  itemId: string
  label: string
  labelKey?: string
  detail: string
  damageType: TheorycraftProcDamageType
  damage: number
}

export interface TheorycraftItemProcConfig {
  itemIds: string[]
  labelKey: string
  damageType: TheorycraftProcDamageType
  compute: (stats: TheorycraftBuildStats) => number
}

/** On-hit / proc damage for theorycraft (approximate, patch-aligned). */
export const THEORYCRAFT_ITEM_PROCS: TheorycraftItemProcConfig[] = [
  {
    itemIds: ['1043'],
    labelKey: 'theorycraft.items.procRecurve',
    damageType: 'physical',
    compute: () => 15,
  },
  {
    itemIds: ['3057', '3078', '3100', '6632', '6662', '3877', '3508'],
    labelKey: 'theorycraft.items.procSheen',
    damageType: 'physical',
    compute: stats => Math.max(0, stats.totalAD - stats.bonusAD),
  },
  {
    itemIds: ['3124'],
    labelKey: 'theorycraft.items.procGuinsoo',
    damageType: 'magic',
    compute: () => 30,
  },
  {
    itemIds: ['3115'],
    labelKey: 'theorycraft.items.procNashor',
    damageType: 'magic',
    compute: stats => 20 + stats.AP * 0.15,
  },
  {
    itemIds: ['3145'],
    labelKey: 'theorycraft.items.procHextechBolt',
    damageType: 'magic',
    compute: stats => 50 + stats.AP * 0.15,
  },
  {
    itemIds: ['3152'],
    labelKey: 'theorycraft.items.procHextechRocket',
    damageType: 'magic',
    compute: stats => 125 + stats.AP * 0.15,
  },
  {
    itemIds: ['3091'],
    labelKey: 'theorycraft.items.procWitsEnd',
    damageType: 'magic',
    compute: stats => 15 + stats.bonusAD * 0.15,
  },
  {
    itemIds: ['3302'],
    labelKey: 'theorycraft.items.procTerminus',
    damageType: 'magic',
    compute: () => 30,
  },
]

function damageTypeLabel(type: TheorycraftProcDamageType, labels: Record<string, string>): string {
  const key =
    type === 'physical'
      ? 'theorycraft.items.procTypePhysical'
      : type === 'magic'
        ? 'theorycraft.items.procTypeMagic'
        : 'theorycraft.items.procTypeTrue'
  return labels[key] ?? type
}

export function computeTheorycraftItemProcLines(args: {
  items: readonly Item[]
  buildStats: TheorycraftBuildStats
  labels: Record<string, string>
}): TheorycraftItemProcLine[] {
  const lines: TheorycraftItemProcLine[] = []
  const seen = new Set<string>()

  for (const item of args.items) {
    const configs = THEORYCRAFT_ITEM_PROCS.filter(config => config.itemIds.includes(item.id))
    for (const config of configs) {
      const dedupeKey = `${item.id}:${config.labelKey}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      const damage = config.compute(args.buildStats)
      if (!Number.isFinite(damage) || damage <= 0) continue

      const rounded = Math.round(damage * 10) / 10
      const typeLabel = damageTypeLabel(config.damageType, args.labels)
      const procLabel = args.labels[config.labelKey] ?? item.name

      lines.push({
        itemId: item.id,
        label: procLabel,
        labelKey: config.labelKey,
        damageType: config.damageType,
        damage: rounded,
        detail: `${rounded} (${typeLabel})`,
      })
    }
  }

  return lines
}

export function isTheorycraftItemWithProc(itemId: string): boolean {
  return THEORYCRAFT_ITEM_PROCS.some(config => config.itemIds.includes(String(itemId)))
}
