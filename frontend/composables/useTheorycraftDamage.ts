import type {
  TheorycraftBuildStats,
  TheorycraftDamageFormula,
  TheorycraftSpellData,
} from '~/types/theorycraft'

export interface TheorycraftDamageOptions {
  exactValues?: boolean
}

function clampRank(rank: number, maxRank: number): number {
  const safeMax = Math.max(1, Math.trunc(maxRank))
  return Math.min(Math.max(Math.trunc(rank), 1), safeMax)
}

function ratioAtRank(coefficient: number[] | number, rankIndex: number): number {
  if (Array.isArray(coefficient)) {
    if (coefficient.length === 0) return 0
    const value = coefficient[Math.min(rankIndex, coefficient.length - 1)]
    return Number.isFinite(value) ? value : 0
  }
  return Number.isFinite(coefficient) ? coefficient : 0
}

function statValue(stats: TheorycraftBuildStats, key: string): number {
  const typedKey = key as keyof TheorycraftBuildStats
  const value = stats[typedKey]
  return Number.isFinite(value) ? value : 0
}

function baseAtRank(baseValues: number[], rankIndex: number): number {
  if (!Array.isArray(baseValues) || baseValues.length === 0) return 0
  const safeIndex = Math.max(0, Math.min(rankIndex, baseValues.length - 1))
  const value = baseValues[safeIndex]
  return Number.isFinite(value) ? value : 0
}

export function calculateDamageFormula(
  formula: TheorycraftDamageFormula,
  stats: TheorycraftBuildStats,
  rank: number,
  maxRank: number,
  options?: TheorycraftDamageOptions
): number {
  const normalizedRank = clampRank(rank, maxRank)
  const rankIndex = normalizedRank - 1
  const base = baseAtRank(formula.baseValues, rankIndex)

  const ratioTotal = (formula.ratios ?? []).reduce((sum, ratio) => {
    const coeff = ratioAtRank(ratio.coefficient, rankIndex)
    return sum + statValue(stats, String(ratio.stat)) * coeff
  }, 0)

  const total = Math.max(0, base + ratioTotal)
  if (options?.exactValues) return total
  return Math.round(total * 100) / 100
}

export function calculateSpellDamages(
  spell: TheorycraftSpellData,
  stats: TheorycraftBuildStats,
  rank: number,
  options?: TheorycraftDamageOptions
): Array<{
  label: string
  value: number
  roundedValue: number
  exactValue: number
  expression?: string
}> {
  const formulas = Array.isArray(spell.damageFormulas) ? spell.damageFormulas : []
  return formulas.map(formula => {
    const exactValue = calculateDamageFormula(formula, stats, rank, spell.maxRank || 5, {
      exactValues: true,
    })
    const roundedValue = Math.round(exactValue * 100) / 100
    return {
      label: formula.label,
      value: options?.exactValues ? exactValue : roundedValue,
      roundedValue,
      exactValue,
      expression: formula.expression,
    }
  })
}
