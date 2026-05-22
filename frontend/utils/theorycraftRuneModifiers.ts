import type {
  CalculatedStats,
  Champion,
  Item,
  RuneSelection,
  ShardSelection,
} from '@lelanation/shared-types'
import {
  resolveTheorycraftAdaptiveStat,
  type TheorycraftAdaptiveStat,
} from './theorycraftAdaptiveStat'

export interface TheorycraftRuneModifierLine {
  runeId: number
  label: string
  labelKey?: string
  detail: string
}

export interface TheorycraftRuneModifierResult {
  stats: CalculatedStats
  lines: TheorycraftRuneModifierLine[]
}

export type TheorycraftRuneStackUnit = 'stacks' | 'souls' | 'legend' | 'mana' | 'hp'

export interface TheorycraftStackableRuneConfig {
  runeIds: number[]
  labelKey: string
  /** Absent when `unlimitedStacks` — no cap in game or in theorycraft. */
  maxStacks?: number
  /** Stacks without upper bound (Grasp, Overgrowth…). */
  unlimitedStacks?: boolean
  /** Value for the « Max » shortcut when stacks are unlimited. */
  presetStacks?: number
  stackUnit: TheorycraftRuneStackUnit
}

export const THEORYCRAFT_STACKABLE_RUNES: TheorycraftStackableRuneConfig[] = [
  { runeIds: [8226], labelKey: 'theorycraft.runes.manaflow', maxStacks: 10, stackUnit: 'mana' },
  {
    runeIds: [8437],
    labelKey: 'theorycraft.runes.grasp',
    unlimitedStacks: true,
    presetStacks: 50,
    stackUnit: 'hp',
  },
  {
    runeIds: [8451],
    labelKey: 'theorycraft.runes.overgrowth',
    unlimitedStacks: true,
    presetStacks: 120,
    stackUnit: 'stacks',
  },
  { runeIds: [8128], labelKey: 'theorycraft.runes.darkHarvest', maxStacks: 25, stackUnit: 'souls' },
  {
    runeIds: [9104],
    labelKey: 'theorycraft.runes.legendAlacrity',
    maxStacks: 10,
    stackUnit: 'legend',
  },
  {
    runeIds: [9105],
    labelKey: 'theorycraft.runes.legendHaste',
    maxStacks: 10,
    stackUnit: 'legend',
  },
  {
    runeIds: [9103],
    labelKey: 'theorycraft.runes.legendBloodline',
    maxStacks: 10,
    stackUnit: 'legend',
  },
]

const GATHERING_STORM_RUNE_ID = 8236
const ABSOLUTE_FOCUS_RUNE_ID = 8233
const TRANSCENDENCE_RUNE_ID = 8210

const GATHERING_STORM_TIERS: { minutes: number; ad: number; ap: number }[] = [
  { minutes: 10, ad: 5, ap: 8 },
  { minutes: 20, ad: 14, ap: 24 },
  { minutes: 30, ad: 29, ap: 48 },
  { minutes: 40, ad: 48, ap: 80 },
  { minutes: 50, ad: 72, ap: 120 },
  { minutes: 60, ad: 101, ap: 168 },
]

export function listSelectedRuneIds(runes: RuneSelection | null | undefined): number[] {
  if (!runes) return []
  const ids = [
    runes.primary.keystone,
    runes.primary.slot1,
    runes.primary.slot2,
    runes.primary.slot3,
    runes.secondary.slot1,
    runes.secondary.slot2,
  ]
  return ids.filter(id => Number.isFinite(id) && id > 0)
}

export function getTheorycraftStackableRuneConfig(
  runeId: number
): TheorycraftStackableRuneConfig | null {
  return THEORYCRAFT_STACKABLE_RUNES.find(config => config.runeIds.includes(runeId)) ?? null
}

export function isTheorycraftStackableRune(runeId: number): boolean {
  return getTheorycraftStackableRuneConfig(runeId) != null
}

export function selectedTheorycraftStackableRunes(
  runes: RuneSelection | null | undefined
): { runeId: number; config: TheorycraftStackableRuneConfig }[] {
  const selected = new Set(listSelectedRuneIds(runes))
  const out: { runeId: number; config: TheorycraftStackableRuneConfig }[] = []
  for (const config of THEORYCRAFT_STACKABLE_RUNES) {
    const runeId = config.runeIds.find(id => selected.has(id))
    if (runeId != null) out.push({ runeId, config })
  }
  return out
}

function clampStacks(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(Math.trunc(value), max))
}

export function resolveTheorycraftStackCount(
  value: number,
  config: Pick<TheorycraftStackableRuneConfig, 'maxStacks' | 'unlimitedStacks'>
): number {
  if (!Number.isFinite(value)) return 0
  const safe = Math.max(0, Math.trunc(value))
  if (config.unlimitedStacks) return safe
  const max = config.maxStacks ?? 0
  if (max <= 0) return safe
  return Math.min(safe, max)
}

function hasteFromCdr(cdr: number): number {
  if (!Number.isFinite(cdr) || cdr <= 0) return 0
  if (cdr >= 1) return 999
  return (1 / (1 - cdr) - 1) * 100
}

function cdrFromHaste(haste: number): number {
  if (!Number.isFinite(haste) || haste <= 0) return 0
  return 1 - 1 / (1 + haste / 100)
}

function addAbilityHaste(stats: CalculatedStats, bonusHaste: number): void {
  if (bonusHaste <= 0) return
  const totalHaste = hasteFromCdr(stats.cooldownReduction) + bonusHaste
  stats.cooldownReduction = cdrFromHaste(totalHaste)
}

function gatheringStormBonus(
  minutes: number,
  adaptive: TheorycraftAdaptiveStat
): {
  attackDamage?: number
  abilityPower?: number
} {
  const m = Math.max(0, Math.trunc(minutes))
  let ad = 0
  let ap = 0
  for (const tier of GATHERING_STORM_TIERS) {
    if (m >= tier.minutes) {
      ad = tier.ad
      ap = tier.ap
    }
  }
  if (m > 60) {
    const extra = Math.floor((m - 60) / 10)
    ad += extra * 29
    ap += extra * 48
  }
  return adaptive === 'ap' ? { abilityPower: ap } : { attackDamage: ad }
}

function absoluteFocusBonus(
  level: number,
  adaptive: TheorycraftAdaptiveStat
): {
  attackDamage?: number
  abilityPower?: number
} {
  const lvl = clampStacks(level, 18)
  return adaptive === 'ap' ? { abilityPower: 3 * lvl } : { attackDamage: 1.8 * lvl }
}

export function getTheorycraftRuneStackStats(
  runeId: number,
  stacks: number,
  _level: number,
  _adaptive: TheorycraftAdaptiveStat
): Record<string, number> {
  const config = getTheorycraftStackableRuneConfig(runeId)
  const count = config
    ? resolveTheorycraftStackCount(stacks, config)
    : Math.max(0, Math.trunc(stacks))
  switch (runeId) {
    case 8226:
      return count > 0 ? { mana: count * 25 } : {}
    case 8437:
      return count > 0 ? { health: count * 5 } : {}
    case 8451: {
      if (count <= 0) return {}
      const out: Record<string, number> = { health: count * 3 }
      return out
    }
    case 9104:
      return count > 0 ? { attackSpeed: 0.03 + 0.015 * count } : {}
    case 9105:
      return count > 0 ? { abilityHaste: 1.5 * count } : {}
    case 9103: {
      if (count <= 0) return {}
      const out: Record<string, number> = { lifeSteal: 0.45 * count }
      if (count >= 10) out.health = 85
      return out
    }
    case 8128:
      return {}
    default:
      return {}
  }
}

function applyOvergrowthPercent(stats: CalculatedStats, stacks: number): void {
  if (stacks < 120) return
  stats.health += Math.round(stats.health * 0.035)
}

function applyFlatRuneBonuses(args: {
  stats: CalculatedStats
  runeIds: number[]
  level: number
  gameDurationMinutes: number
  adaptive: TheorycraftAdaptiveStat
  lines: TheorycraftRuneModifierLine[]
  labels: Record<string, string>
}): void {
  const { stats, runeIds, level, gameDurationMinutes, adaptive, lines, labels } = args
  const idSet = new Set(runeIds)

  if (idSet.has(TRANSCENDENCE_RUNE_ID) && level >= 5) {
    const haste = level >= 8 ? 10 : 5
    addAbilityHaste(stats, haste)
    lines.push({
      runeId: TRANSCENDENCE_RUNE_ID,
      label: labels['theorycraft.runes.transcendence'] ?? 'Transcendence',
      labelKey: 'theorycraft.runes.transcendence',
      detail: `+${haste} hâte (niv. ${level})`,
    })
  }

  if (idSet.has(ABSOLUTE_FOCUS_RUNE_ID)) {
    const bonus = absoluteFocusBonus(level, adaptive)
    if (bonus.abilityPower) stats.abilityPower += bonus.abilityPower
    if (bonus.attackDamage) stats.attackDamage += bonus.attackDamage
    lines.push({
      runeId: ABSOLUTE_FOCUS_RUNE_ID,
      label: labels['theorycraft.runes.absoluteFocus'] ?? 'Absolute Focus',
      labelKey: 'theorycraft.runes.absoluteFocus',
      detail:
        adaptive === 'ap'
          ? `+${bonus.abilityPower} AP (niv. ${level}, >70% PV)`
          : `+${bonus.attackDamage} AD (niv. ${level}, >70% PV)`,
    })
  }

  if (idSet.has(GATHERING_STORM_RUNE_ID) && gameDurationMinutes > 0) {
    const bonus = gatheringStormBonus(gameDurationMinutes, adaptive)
    if (bonus.abilityPower) stats.abilityPower += bonus.abilityPower
    if (bonus.attackDamage) stats.attackDamage += bonus.attackDamage
    lines.push({
      runeId: GATHERING_STORM_RUNE_ID,
      label: labels['theorycraft.runes.gatheringStorm'] ?? 'Gathering Storm',
      labelKey: 'theorycraft.runes.gatheringStorm',
      detail:
        adaptive === 'ap'
          ? `+${bonus.abilityPower} AP (${gameDurationMinutes} min)`
          : `+${bonus.attackDamage} AD (${gameDurationMinutes} min)`,
    })
  }
}

/** Lignes d'affichage pour les shards (déjà dans calculateStats ; pas de double compte). */
export function getTheorycraftShardModifierLines(
  shards: ShardSelection | null | undefined,
  level: number,
  adaptive: TheorycraftAdaptiveStat,
  labels: Record<string, string>
): TheorycraftRuneModifierLine[] {
  if (!shards) return []
  const lines: TheorycraftRuneModifierLine[] = []
  const scalingHp = Math.round(10 + (level - 1) * (190 / 17))

  const push = (slot: number, shardId: number, detail: string, labelKey: string) => {
    lines.push({
      runeId: shardId,
      label: labels[labelKey] ?? `Shard ${slot}`,
      labelKey,
      detail,
    })
  }

  if (shards.slot1 === 5008) {
    push(1, 5008, adaptive === 'ap' ? '+9 AP' : '+5.4 AD', 'theorycraft.shards.adaptive')
  } else if (shards.slot1 === 5005) push(1, 5005, '+10% AS', 'theorycraft.shards.attackSpeed')
  else if (shards.slot1 === 5007) push(1, 5007, '+8 hâte', 'theorycraft.shards.haste')

  if (shards.slot2 === 5008) {
    push(2, 5008, adaptive === 'ap' ? '+9 AP' : '+5.4 AD', 'theorycraft.shards.adaptive')
  } else if (shards.slot2 === 5006 || shards.slot2 === 5010) {
    push(2, shards.slot2, '+2.5% MS', 'theorycraft.shards.moveSpeed')
  } else if (shards.slot2 === 5002 || shards.slot2 === 5001) {
    push(2, shards.slot2, `+${scalingHp} PV (niv. ${level})`, 'theorycraft.shards.healthScaling')
  }

  if (shards.slot3 === 5011) push(3, 5011, '+65 PV', 'theorycraft.shards.healthFlat')
  else if (shards.slot3 === 5013 || shards.slot3 === 5003) {
    push(3, shards.slot3, '+15% ténacité', 'theorycraft.shards.tenacity')
  } else if (shards.slot3 === 5002 || shards.slot3 === 5001) {
    push(3, shards.slot3, `+${scalingHp} PV (niv. ${level})`, 'theorycraft.shards.healthScaling')
  }

  return lines
}

export function applyTheorycraftRuneModifiers(args: {
  stats: CalculatedStats
  runes: RuneSelection | null | undefined
  shards: ShardSelection | null | undefined
  runeStacksById: Record<number, number>
  level: number
  gameDurationMinutes: number
  adaptive: TheorycraftAdaptiveStat
  labels: Record<string, string>
}): TheorycraftRuneModifierResult {
  const stats: CalculatedStats = { ...args.stats }
  const lines: TheorycraftRuneModifierLine[] = []
  const runeIds = listSelectedRuneIds(args.runes)

  applyFlatRuneBonuses({
    stats,
    runeIds,
    level: args.level,
    gameDurationMinutes: args.gameDurationMinutes,
    adaptive: args.adaptive,
    lines,
    labels: args.labels,
  })

  lines.push(
    ...getTheorycraftShardModifierLines(args.shards, args.level, args.adaptive, args.labels)
  )

  for (const runeId of runeIds) {
    const config = getTheorycraftStackableRuneConfig(runeId)
    if (!config) continue

    const stacks = resolveTheorycraftStackCount(args.runeStacksById[runeId] ?? 0, config)
    const label = args.labels[config.labelKey] ?? String(runeId)

    if (runeId === 8128) {
      if (stacks > 0) {
        lines.push({
          runeId,
          label,
          labelKey: config.labelKey,
          detail: `${stacks} ${config.stackUnit} (+${stacks * 11} dmg)`,
        })
      }
      continue
    }

    if (stacks <= 0) continue

    const bonus = getTheorycraftRuneStackStats(runeId, stacks, args.level, args.adaptive)
    if (bonus.mana) stats.mana += bonus.mana
    if (bonus.health) stats.health += bonus.health
    if (bonus.attackDamage) stats.attackDamage += bonus.attackDamage
    if (bonus.abilityPower) stats.abilityPower += bonus.abilityPower
    if (bonus.attackSpeed) stats.attackSpeed *= 1 + bonus.attackSpeed
    if (bonus.lifeSteal) stats.lifeSteal += bonus.lifeSteal / 100
    if (bonus.abilityHaste) addAbilityHaste(stats, bonus.abilityHaste)

    if (runeId === 8451) applyOvergrowthPercent(stats, stacks)

    lines.push({
      runeId,
      label,
      labelKey: config.labelKey,
      detail: `+${stacks} ${config.stackUnit}`,
    })
  }

  return { stats, lines }
}

/** Ajuste les stats si les shards adaptatifs ont été calculés en AD par défaut. */
export function applyAdaptiveShardCorrection(
  stats: CalculatedStats,
  shards: ShardSelection | null | undefined,
  adaptive: TheorycraftAdaptiveStat
): CalculatedStats {
  if (adaptive !== 'ap' || !shards) return stats
  let adaptiveCount = 0
  if (shards.slot1 === 5008) adaptiveCount += 1
  if (shards.slot2 === 5008) adaptiveCount += 1
  if (adaptiveCount === 0) return stats

  const next = { ...stats }
  next.attackDamage -= 5.4 * adaptiveCount
  next.abilityPower += 9 * adaptiveCount
  return next
}

export function resolveTheorycraftAdaptiveForBuild(
  champion: Champion | null | undefined,
  items: readonly Item[]
): TheorycraftAdaptiveStat {
  return resolveTheorycraftAdaptiveStat(champion, items)
}
