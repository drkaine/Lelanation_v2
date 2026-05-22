import type { CalculatedStats } from '@lelanation/shared-types'
import { calculateDamageFormula } from '../composables/useTheorycraftDamage'
import type { TheorycraftBuildStats } from '~/types/theorycraft'
import type { TheorycraftSpellCalculation } from '~/composables/useTheorycraftTooltip'

export interface TheorycraftSpellRuntime {
  id?: string
  slot?: string
  tooltipRaw?: string
  calculations?: TheorycraftSpellCalculation[]
  dataValues?: Array<{ name: string; values: number[] }>
  maxRank?: number
}

export interface TheorycraftSpellBuffBonus {
  stat: keyof Pick<
    CalculatedStats,
    | 'armor'
    | 'magicResist'
    | 'attackDamage'
    | 'abilityPower'
    | 'health'
    | 'attackSpeed'
    | 'movementSpeed'
  >
  amount: number
  labelKey: string
}

export interface TheorycraftSpellBuffLine {
  spellId: string
  spellSlot: string
  spellName: string
  label: string
  detail: string
}

type DataValues = Array<{ name: string; values: number[] }>

function valueAtRank(values: number[], rankIndex: number): number | null {
  if (values.length === 0) return null
  const value = values[Math.min(Math.max(rankIndex, 0), values.length - 1)] ?? NaN
  return Number.isFinite(value) ? value : null
}

function dataValueAtRank(
  dataValues: DataValues | undefined,
  name: string,
  rankIndex: number
): number | null {
  const entry = dataValues?.find(item => item.name.toLowerCase() === name.toLowerCase())
  return entry ? valueAtRank(entry.values, rankIndex) : null
}

function toBuildStats(stats: CalculatedStats, level: number): TheorycraftBuildStats {
  return {
    level,
    totalAD: stats.attackDamage,
    bonusAD: 0,
    AP: stats.abilityPower,
    totalHP: stats.health,
    bonusHP: 0,
    armor: stats.armor,
    magicResist: stats.magicResist,
    maxMana: stats.mana,
    critChance: stats.critChance,
    critDamage: stats.critDamage,
    cooldownReduction: stats.cooldownReduction ?? 0,
  }
}

function calcValue(
  calculation: TheorycraftSpellCalculation,
  stats: CalculatedStats,
  rank: number,
  maxRank: number,
  level: number
): number {
  return calculateDamageFormula(
    {
      label: calculation.key,
      baseValues: calculation.baseValues,
      ratios: (calculation.ratios ?? []).map(ratio => ({
        stat: ratio.stat,
        coefficient: ratio.coefficient,
        type: (ratio.type as 'physical' | 'magic' | 'true') ?? 'physical',
      })),
    },
    toBuildStats(stats, level),
    rank,
    maxRank,
    { exactValues: true }
  )
}

const DAMAGE_CALC_PATTERN =
  /damagecalc|totaldamage|initialdamage|pulsedamage|monsterdamage|returndamage/i

function isStatBuffCalculationKey(key: string): boolean {
  const normalized = key.toLowerCase()
  if (DAMAGE_CALC_PATTERN.test(normalized)) return false
  return (
    /bonusarmortooltip|totalbonusarmor|bonusarmor(?!pen)/i.test(normalized) ||
    /bonusmrtooltip|totalbonusmr|bonusspellblock|bonusmagicresist/i.test(normalized) ||
    /bonusadtooltip|bonusattackdamage|bonusphysicaldamage/i.test(normalized) ||
    /bonusaptooltip|bonusabilitypower|bonusap(?!ratio)/i.test(normalized) ||
    /bonushptooltip|bonushealth|bonushp(?!regen)/i.test(normalized) ||
    /attackspeedbonus|bonusattackspeed/i.test(normalized) ||
    /msbuff|movementspeedbonus|bonusms/i.test(normalized)
  )
}

function mapBuffKeyToStat(key: string): TheorycraftSpellBuffBonus['stat'] | null {
  const normalized = key.toLowerCase()
  if (/armor/.test(normalized) && !/mr|magic|spellblock/.test(normalized)) return 'armor'
  if (/mr|magicresist|spellblock/.test(normalized)) return 'magicResist'
  if (/attackdamage|physicaldamage|bonusad/.test(normalized)) return 'attackDamage'
  if (/abilitypower|bonusap/.test(normalized)) return 'abilityPower'
  if (/health|bonushp/.test(normalized)) return 'health'
  if (/attackspeed/.test(normalized)) return 'attackSpeed'
  if (/ms|movementspeed|speedbuff/.test(normalized)) return 'movementSpeed'
  return null
}

function tooltipSuggestsStatBuff(tooltipRaw: string): boolean {
  const raw = String(tooltipRaw ?? '')
  if (!raw) return false
  return /scaleArmor|scaleMR|scaleAD|scaleAP|scaleHealth|scaleAS|scaleAttackSpeed/i.test(raw)
}

function hasFlatStatBuffDataValues(dataValues: DataValues): boolean {
  const keys = [
    'FlatBonusArmor',
    'BonusArmorPercent',
    'FlatBonusMR',
    'BonusMRPercent',
    'BonusHealth',
    'InitialResistGain',
    'BonusResist',
    'ResistGain',
  ]
  return keys.some(name => dataValueAtRank(dataValues, name, 0) != null)
}

export function spellHasActivatableBuff(spell: TheorycraftSpellRuntime): boolean {
  const calculations = spell.calculations ?? []
  if (calculations.some(c => isStatBuffCalculationKey(c.key))) return true
  const dv = spell.dataValues ?? []
  if (hasFlatStatBuffDataValues(dv)) return true
  return tooltipSuggestsStatBuff(spell.tooltipRaw ?? '')
}

export function computeSpellBuffBonuses(
  spell: TheorycraftSpellRuntime,
  rank: number,
  stats: CalculatedStats,
  level: number
): TheorycraftSpellBuffBonus[] {
  const maxRank = Math.max(1, Number(spell.maxRank ?? 5))
  const safeRank = Math.min(Math.max(Math.trunc(rank), 1), maxRank)
  const rankIndex = safeRank - 1
  const dataValues = spell.dataValues ?? []
  const bonuses: TheorycraftSpellBuffBonus[] = []
  const seen = new Set<string>()

  const pushBonus = (stat: TheorycraftSpellBuffBonus['stat'], amount: number, labelKey: string) => {
    if (!Number.isFinite(amount) || amount <= 0) return
    const key = `${stat}:${labelKey}`
    if (seen.has(key)) return
    seen.add(key)
    bonuses.push({ stat, amount, labelKey })
  }

  let armorFromDataValues = false
  let mrFromDataValues = false

  const flatArmor = dataValueAtRank(dataValues, 'FlatBonusArmor', rankIndex)
  const pctArmor = dataValueAtRank(dataValues, 'BonusArmorPercent', rankIndex)
  if (flatArmor != null || pctArmor != null) {
    const amount = (flatArmor ?? 0) + (pctArmor ?? 0) * stats.armor
    pushBonus('armor', amount, 'theorycraft.spells.buffArmor')
    armorFromDataValues = true
  }

  const flatMr = dataValueAtRank(dataValues, 'FlatBonusMR', rankIndex)
  const pctMr = dataValueAtRank(dataValues, 'BonusMRPercent', rankIndex)
  if (flatMr != null || pctMr != null) {
    const amount = (flatMr ?? 0) + (pctMr ?? 0) * stats.magicResist
    pushBonus('magicResist', amount, 'theorycraft.spells.buffMr')
    mrFromDataValues = true
  }

  const bonusHealth = dataValueAtRank(dataValues, 'BonusHealth', rankIndex)
  if (bonusHealth != null && bonusHealth > 0) {
    pushBonus('health', bonusHealth, 'theorycraft.spells.buffHp')
  }

  const initialResistGain =
    dataValueAtRank(dataValues, 'InitialResistGain', rankIndex) ??
    dataValueAtRank(dataValues, 'BonusResist', rankIndex) ??
    dataValueAtRank(dataValues, 'ResistGain', rankIndex)
  if (initialResistGain != null && initialResistGain > 0) {
    pushBonus('armor', initialResistGain, 'theorycraft.spells.buffArmor')
    pushBonus('magicResist', initialResistGain, 'theorycraft.spells.buffMr')
    armorFromDataValues = true
    mrFromDataValues = true
  }

  for (const calculation of spell.calculations ?? []) {
    if (!isStatBuffCalculationKey(calculation.key)) continue
    const stat = mapBuffKeyToStat(calculation.key)
    if (!stat) continue
    if (stat === 'armor' && armorFromDataValues) continue
    if (stat === 'magicResist' && mrFromDataValues) continue
    const amount = calcValue(calculation, stats, safeRank, maxRank, level)
    const labelKey =
      stat === 'armor'
        ? 'theorycraft.spells.buffArmor'
        : stat === 'magicResist'
          ? 'theorycraft.spells.buffMr'
          : stat === 'attackDamage'
            ? 'theorycraft.spells.buffAd'
            : stat === 'abilityPower'
              ? 'theorycraft.spells.buffAp'
              : stat === 'health'
                ? 'theorycraft.spells.buffHp'
                : stat === 'attackSpeed'
                  ? 'theorycraft.spells.buffAs'
                  : 'theorycraft.spells.buffMs'
    pushBonus(stat, amount, labelKey)
  }

  return bonuses
}

export function applyTheorycraftSpellBuffs(args: {
  stats: CalculatedStats
  spells: TheorycraftSpellRuntime[]
  activeSpellIds: ReadonlySet<string>
  spellRanks: Record<string, number>
  level: number
  labels: Record<string, string>
}): { stats: CalculatedStats; lines: TheorycraftSpellBuffLine[] } {
  const next: CalculatedStats = { ...args.stats }
  const lines: TheorycraftSpellBuffLine[] = []

  for (const spell of args.spells) {
    const spellId = String(spell.id ?? '')
    if (!spellId || !args.activeSpellIds.has(spellId)) continue
    if (!spellHasActivatableBuff(spell)) continue

    const rank = args.spellRanks[spellId] ?? 1
    const bonuses = computeSpellBuffBonuses(spell, rank, next, args.level)
    if (bonuses.length === 0) continue

    const parts: string[] = []
    for (const bonus of bonuses) {
      next[bonus.stat] = (next[bonus.stat] ?? 0) + bonus.amount
      const label = args.labels[bonus.labelKey] ?? bonus.stat
      parts.push(`+${Math.round(bonus.amount * 10) / 10} ${label}`)
    }

    const spellName = String((spell as { name?: string }).name ?? spell.slot ?? spellId)
    lines.push({
      spellId,
      spellSlot: String(spell.slot ?? ''),
      spellName,
      label: spellName,
      detail: parts.join(', '),
    })
  }

  return { stats: next, lines }
}
