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
  /damagecalc|totaldamage|initialdamage|pulsedamage|monsterdamage|returndamage|pertickdamage|totalshield|shieldamount|heal|fury/i

const REFERENCE_STATS: CalculatedStats = {
  health: 2000,
  mana: 800,
  attackDamage: 200,
  abilityPower: 100,
  armor: 100,
  magicResist: 60,
  attackSpeed: 1,
  critChance: 0,
  critDamage: 1.75,
  lifeSteal: 0,
  spellVamp: 0,
  cooldownReduction: 0,
  movementSpeed: 340,
  healthRegen: 5,
  manaRegen: 5,
  armorPenetration: 0,
  flatArmorPenetration: 0,
  magicPenetration: 0,
  flatMagicPenetration: 0,
  tenacity: 0,
  lethality: 0,
  percentLethality: 0,
  omnivamp: 0,
  shield: 0,
  healShieldPower: 0,
  attackRange: 125,
  goldPer10: 0,
}

function isStatBuffCalculationKey(key: string): boolean {
  const normalized = key.toLowerCase()
  if (DAMAGE_CALC_PATTERN.test(normalized)) return false
  if (
    /grantedally|allyarmor|allymr|rangedformshred|shred|slow|penetration|lethality/i.test(
      normalized
    )
  ) {
    return false
  }
  return (
    /bonusarmortooltip|totalbonusarmor|bonusarmor(?!pen)|basearmor|grantedbraumarmor/i.test(
      normalized
    ) ||
    /bonusmrtooltip|totalbonusmr|bonusspellblock|bonusmagicresist|bonusmr(?!grant)|basemr|grantedbraummr/i.test(
      normalized
    ) ||
    /bonusadtooltip|bonusattackdamage|totalad|^ad$|bonusphysicaldamage/i.test(normalized) ||
    /bonusaptooltip|bonusabilitypower|bonusap(?!ratio)/i.test(normalized) ||
    /bonushptooltip|bonushealth|bonushp(?!regen)/i.test(normalized) ||
    /attackspeedbonus|bonusattackspeed|bonusattackspeedcalc/i.test(normalized) ||
    /msbuff|movementspeedbonus|bonusms|mrgrant|totalresists|resistsfortooltip|^resists$/i.test(
      normalized
    )
  )
}

function mapBuffKeyToStat(key: string): TheorycraftSpellBuffBonus['stat'] | null {
  const normalized = key.toLowerCase()
  if (/^ad$|attackdamage|physicaldamage|bonusad|totalad/.test(normalized)) return 'attackDamage'
  if (/abilitypower|bonusap/.test(normalized)) return 'abilityPower'
  if (/health|bonushp/.test(normalized)) return 'health'
  if (/attackspeed/.test(normalized)) return 'attackSpeed'
  if (/ms|movementspeed|speedbuff|mrgrant/.test(normalized)) return 'magicResist'
  if (/mr|magicresist|spellblock|totalresists|^resists$|resistsfortooltip/.test(normalized)) {
    return 'magicResist'
  }
  if (/armor/.test(normalized)) return 'armor'
  return null
}

function isDualResistCalculationKey(key: string): boolean {
  const normalized = key.toLowerCase()
  return (
    normalized === 'totalresists' || normalized === 'resists' || normalized === 'resistsfortooltip'
  )
}

function labelKeyForStat(stat: TheorycraftSpellBuffBonus['stat']): string {
  if (stat === 'armor') return 'theorycraft.spells.buffArmor'
  if (stat === 'magicResist') return 'theorycraft.spells.buffMr'
  if (stat === 'attackDamage') return 'theorycraft.spells.buffAd'
  if (stat === 'abilityPower') return 'theorycraft.spells.buffAp'
  if (stat === 'health') return 'theorycraft.spells.buffHp'
  if (stat === 'attackSpeed') return 'theorycraft.spells.buffAs'
  return 'theorycraft.spells.buffMs'
}

function normalizeAttackSpeedBonus(amount: number): number {
  if (amount > 10) return amount / 100
  return amount
}

export function spellHasActivatableBuff(spell: TheorycraftSpellRuntime): boolean {
  const maxRank = Math.max(1, Number(spell.maxRank ?? 5))
  return computeSpellBuffBonuses(spell, maxRank, REFERENCE_STATS, 18).length > 0
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

  let armorFromTooltipCalc = false
  let mrFromTooltipCalc = false

  const tooltipArmorCalc = (spell.calculations ?? []).find(
    c => c.key.toLowerCase() === 'bonusarmortooltip'
  )
  const tooltipMrCalc = (spell.calculations ?? []).find(
    c => c.key.toLowerCase() === 'bonusmrtooltip'
  )

  if (tooltipArmorCalc) {
    const amount = calcValue(tooltipArmorCalc, stats, safeRank, maxRank, level)
    pushBonus('armor', amount, 'theorycraft.spells.buffArmor')
    armorFromTooltipCalc = true
  }

  if (tooltipMrCalc) {
    const amount = calcValue(tooltipMrCalc, stats, safeRank, maxRank, level)
    pushBonus('magicResist', amount, 'theorycraft.spells.buffMr')
    mrFromTooltipCalc = true
  }

  if (!armorFromTooltipCalc) {
    const flatArmor = dataValueAtRank(dataValues, 'FlatBonusArmor', rankIndex)
    const pctArmor = dataValueAtRank(dataValues, 'BonusArmorPercent', rankIndex)
    if (flatArmor != null || pctArmor != null) {
      const amount = (flatArmor ?? 0) + (pctArmor ?? 0) * stats.armor
      pushBonus('armor', amount, 'theorycraft.spells.buffArmor')
      armorFromTooltipCalc = true
    }
  }

  if (!mrFromTooltipCalc) {
    const flatMr = dataValueAtRank(dataValues, 'FlatBonusMR', rankIndex)
    const pctMr = dataValueAtRank(dataValues, 'BonusMRPercent', rankIndex)
    if (flatMr != null || pctMr != null) {
      const amount = (flatMr ?? 0) + (pctMr ?? 0) * stats.magicResist
      pushBonus('magicResist', amount, 'theorycraft.spells.buffMr')
      mrFromTooltipCalc = true
    }
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
    armorFromTooltipCalc = true
    mrFromTooltipCalc = true
  }

  const flatResists =
    dataValueAtRank(dataValues, 'Resists', rankIndex) ??
    dataValueAtRank(dataValues, 'KennenRDefenses', rankIndex) ??
    dataValueAtRank(dataValues, 'BaseResists', rankIndex)
  if (flatResists != null && flatResists > 0) {
    pushBonus('armor', flatResists, 'theorycraft.spells.buffArmor')
    pushBonus('magicResist', flatResists, 'theorycraft.spells.buffMr')
    armorFromTooltipCalc = true
    mrFromTooltipCalc = true
  }

  const flatAd =
    dataValueAtRank(dataValues, 'FlatAD', rankIndex) ??
    dataValueAtRank(dataValues, 'BonusAD', rankIndex)
  if (flatAd != null && flatAd > 0) {
    pushBonus('attackDamage', flatAd, 'theorycraft.spells.buffAd')
  }

  const maximumBonusAd = dataValueAtRank(dataValues, 'MaximumBonusAD', rankIndex)
  if (maximumBonusAd != null && maximumBonusAd > 0) {
    pushBonus('attackDamage', maximumBonusAd, 'theorycraft.spells.buffAd')
  }

  const percentTotalAdAmp =
    dataValueAtRank(dataValues, 'RTotalADAmp', rankIndex) ??
    dataValueAtRank(dataValues, 'PercentTotalADAmp', rankIndex)
  if (percentTotalAdAmp != null && percentTotalAdAmp > 0) {
    pushBonus('attackDamage', percentTotalAdAmp * stats.attackDamage, 'theorycraft.spells.buffAd')
  }

  const percentMoveSpeed =
    dataValueAtRank(dataValues, 'RMovementSpeedBonus', rankIndex) ??
    dataValueAtRank(dataValues, 'ExtraMoveSpeedPercent', rankIndex)
  if (percentMoveSpeed != null && percentMoveSpeed > 0) {
    pushBonus('movementSpeed', percentMoveSpeed * stats.movementSpeed, 'theorycraft.spells.buffMs')
  }

  const statAmount = dataValueAtRank(dataValues, 'StatAmount', rankIndex)
  if (statAmount != null && statAmount > 0) {
    pushBonus('abilityPower', statAmount, 'theorycraft.spells.buffAp')
    pushBonus('armor', statAmount, 'theorycraft.spells.buffArmor')
    pushBonus('magicResist', statAmount, 'theorycraft.spells.buffMr')
    pushBonus('movementSpeed', statAmount, 'theorycraft.spells.buffMs')
    armorFromTooltipCalc = true
    mrFromTooltipCalc = true
  }

  const armorPerStack = dataValueAtRank(dataValues, 'ArmorPerStack', rankIndex)
  const maxStacks = dataValueAtRank(dataValues, 'MaxStacks', rankIndex)
  const hasStackedResists =
    armorPerStack != null && maxStacks != null && armorPerStack > 0 && maxStacks > 0
  if (hasStackedResists) {
    pushBonus('armor', armorPerStack * maxStacks, 'theorycraft.spells.buffArmor')
    armorFromTooltipCalc = true
  }

  const attackSpeedBonus = dataValueAtRank(dataValues, 'AttackSpeed', rankIndex)
  if (attackSpeedBonus != null && attackSpeedBonus > 0) {
    const normalized =
      attackSpeedBonus > 1 && attackSpeedBonus <= 100 ? attackSpeedBonus / 100 : attackSpeedBonus
    pushBonus('attackSpeed', normalized, 'theorycraft.spells.buffAs')
  }

  for (const calculation of spell.calculations ?? []) {
    if (!isStatBuffCalculationKey(calculation.key)) continue
    const normalizedKey = calculation.key.toLowerCase()
    if (
      normalizedKey === 'bonusarmortooltip' ||
      normalizedKey === 'bonusmrtooltip' ||
      (normalizedKey === 'mrgrant' && hasStackedResists)
    ) {
      continue
    }

    let amount = calcValue(calculation, stats, safeRank, maxRank, level)
    if (normalizedKey === 'resistsfortooltip' && amount < 1) {
      amount = dataValueAtRank(dataValues, 'ResistMax', rankIndex) ?? amount
    }

    if (isDualResistCalculationKey(calculation.key)) {
      if (!armorFromTooltipCalc) {
        pushBonus('armor', amount, 'theorycraft.spells.buffArmor')
        armorFromTooltipCalc = true
      }
      if (!mrFromTooltipCalc) {
        pushBonus('magicResist', amount, 'theorycraft.spells.buffMr')
        mrFromTooltipCalc = true
      }
      continue
    }

    const stat = mapBuffKeyToStat(calculation.key)
    if (!stat) continue
    if (stat === 'armor' && armorFromTooltipCalc) continue
    if (stat === 'magicResist' && mrFromTooltipCalc) continue
    if (stat === 'attackSpeed') {
      amount = normalizeAttackSpeedBonus(amount)
    }

    pushBonus(stat, amount, labelKeyForStat(stat))
  }

  if (hasStackedResists) {
    const mrGrantCalc = (spell.calculations ?? []).find(c => c.key.toLowerCase() === 'mrgrant')
    if (mrGrantCalc && !mrFromTooltipCalc) {
      const mrPerStack = calcValue(mrGrantCalc, stats, safeRank, maxRank, level)
      pushBonus('magicResist', mrPerStack * maxStacks, 'theorycraft.spells.buffMr')
    }
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
