import type { TheorycraftBuildStats, TheorycraftStackDefinition } from '../types/theorycraft'
import {
  applyStackTooltipVariables,
  resolveStackCalculations,
  stackDamageBonusForCalculation,
} from '../utils/theorycraftStacks'
import { formatTooltipMarkupHtml } from '../utils/formatTooltipMarkupHtml'
import { calculateDamageFormula } from './useTheorycraftDamage'

export interface TheorycraftSpellCalculation {
  key: string
  baseValues: number[]
  ratios: Array<{
    stat: string
    coefficient: number[] | number
    type?: string
  }>
}

export interface TheorycraftSpellRuntimeData {
  tooltipRaw?: string
  tooltipDetailRaws?: string[]
  calculations?: TheorycraftSpellCalculation[]
  dataValues?: Array<{ name: string; values: number[] }>
  spellEffects?: Array<{ key: string; values: number[] }>
  maxRank?: number
}

export interface TheorycraftStackResolveContext {
  definition: TheorycraftStackDefinition
  stackCount: number
  calculationsBySource: Record<string, TheorycraftSpellCalculation[]>
}

function formatResolvedNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const rounded = Math.round(value * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function formatValueSeries(values: number[], separator = ' / '): string {
  if (values.length === 0) return ''
  const formatted = values.map(formatResolvedNumber)
  const allSame = formatted.every(v => v === formatted[0])
  if (allSame) return formatted[0] ?? ''
  return formatted.join(separator)
}

function valueAtRank(values: number[], rankIndex: number): number | null {
  if (values.length === 0) return null
  const value = values[Math.min(Math.max(rankIndex, 0), values.length - 1)]
  return Number.isFinite(value) ? value : null
}

function formatValueAtRank(values: number[], rankIndex: number): string {
  const value = valueAtRank(values, rankIndex)
  return value == null ? '' : formatResolvedNumber(value)
}

function parseNumberSeries(raw: string): number[] {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return []
  if (trimmed.includes('/')) {
    return trimmed
      .split('/')
      .map(part => Number(part.trim()))
      .filter(n => Number.isFinite(n))
  }
  const single = Number(trimmed)
  return Number.isFinite(single) ? [single] : []
}

function statValue(stats: TheorycraftBuildStats, key: string): number {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  const aliases: Record<string, keyof TheorycraftBuildStats> = {
    ap: 'AP',
    abilitypower: 'AP',
    totalad: 'totalAD',
    attackdamage: 'totalAD',
    bonusad: 'bonusAD',
    bonusattackdamage: 'bonusAD',
    totalhp: 'totalHP',
    health: 'totalHP',
    bonushp: 'bonusHP',
    bonushealth: 'bonusHP',
    armor: 'armor',
    bonusarmor: 'armor',
    magicresist: 'magicResist',
    bonusmagicresist: 'magicResist',
    spellblock: 'magicResist',
    maxmana: 'maxMana',
    mana: 'maxMana',
    critchance: 'critChance',
    critdamage: 'critDamage',
  }
  const alias = aliases[normalized]
  if (alias) {
    const value = stats[alias]
    return Number.isFinite(value) ? Number(value) : 0
  }
  const typedKey = key as keyof TheorycraftBuildStats
  const value = stats[typedKey]
  return Number.isFinite(value) ? Number(value) : 0
}

function applyScalingTooltipAliases(
  setVar: (key: string, value: string) => void,
  calculations: TheorycraftSpellCalculation[],
  stats: TheorycraftBuildStats,
  rankIndex: number
): void {
  for (const calculation of calculations) {
    const base = valueAtRank(calculation.baseValues, rankIndex)
    if (base != null) {
      setVar('effect1amount', formatResolvedNumber(base))
    }

    for (const ratio of calculation.ratios ?? []) {
      const coeff = ratioAtRank(ratio.coefficient, rankIndex)
      const amount = statValue(stats, ratio.stat) * coeff
      if (amount <= 0) continue
      const formatted = formatResolvedNumber(amount)
      const statKey = ratio.stat.toLowerCase().replace(/[^a-z0-9]/g, '')

      if (statKey === 'ap' || statKey === 'abilitypower') {
        setVar('charabilitypower', formatted)
      }
      if (statKey === 'totalad' || statKey === 'attackdamage' || statKey === 'bonusad') {
        setVar('charbonusphysicaldamage', formatted)
      }
      if (statKey === 'totalhp' || statKey === 'bonushp' || statKey === 'health') {
        setVar('charhealth', formatted)
      }
      if (statKey === 'maxmana' || statKey === 'mana') {
        setVar('charmana', formatted)
      }
    }
  }
}

function ratioAtRank(coefficient: number[] | number, rankIndex: number): number {
  if (Array.isArray(coefficient)) {
    if (coefficient.length === 0) return 0
    const value = coefficient[Math.min(rankIndex, coefficient.length - 1)]
    return Number.isFinite(value) ? value : 0
  }
  return Number.isFinite(coefficient) ? coefficient : 0
}

function ratioStatDisplayLabel(stat: string): string {
  const labels: Record<string, string> = {
    totalAD: 'AD',
    bonusAD: 'AD',
    AP: 'AP',
    critDamage: 'crit',
    bonusArmor: 'bonus Armor',
    armor: 'Armor',
    bonusMagicResist: 'bonus Magic Resist',
    magicResist: 'Magic Resist',
    totalHP: 'max Health',
    bonusHP: 'bonusHP',
    maxMana: 'max Mana',
  }
  return labels[stat] ?? stat
}

function ratioScaleClass(stat: string): string {
  const normalized = stat.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized === 'totalad' || normalized === 'bonusad' || normalized === 'attackdamage') {
    return 'scale-ad'
  }
  return 'scale-ap'
}

function formatRatioPercentSuffix(
  ratio: { stat: string; coefficient: number[] | number },
  rankIndex: number
): string {
  const coeff = ratioAtRank(ratio.coefficient, rankIndex)
  if (coeff === 0) return ''
  const pct = formatResolvedNumber(coeff * 100)
  return `(+ ${pct}% ${ratioStatDisplayLabel(ratio.stat)})`
}

function formatRatioSuffix(
  ratio: { stat: string; coefficient: number[] | number },
  rankIndex: number,
  stats: TheorycraftBuildStats
): string {
  const percentPart = formatRatioPercentSuffix(ratio, rankIndex)
  if (!percentPart) return ''

  const coeff = ratioAtRank(ratio.coefficient, rankIndex)
  const statAmount = statValue(stats, ratio.stat) * coeff
  if (statAmount <= 0) {
    return `<span class="tooltip-tag ${ratioScaleClass(ratio.stat)}">${percentPart}</span>`
  }

  return `<span class="tooltip-tag ${ratioScaleClass(ratio.stat)}">${percentPart} (+ ${formatResolvedNumber(statAmount)})</span>`
}

function computeCalculationValue(
  calculation: TheorycraftSpellCalculation,
  stats: TheorycraftBuildStats,
  rank: number,
  maxRank: number
): number {
  return calculateDamageFormula(
    {
      label: calculation.key,
      baseValues: calculation.baseValues,
      ratios: calculation.ratios.map(ratio => ({
        stat: ratio.stat,
        coefficient: ratio.coefficient,
        type: (ratio.type as 'physical' | 'magic' | 'true') ?? 'physical',
      })),
    },
    stats,
    rank,
    maxRank,
    { exactValues: true }
  )
}

function isPercentLikeCalculation(calculation: TheorycraftSpellCalculation): boolean {
  const key = calculation.key.toLowerCase()
  if (key.includes('percent') || key.includes('damagecalc') || key.includes('manacalc')) {
    return true
  }
  const base = calculation.baseValues[0]
  return Number.isFinite(base) && Math.abs(base) > 0 && Math.abs(base) < 1
}

function formatCalculationRenderedValue(
  calculation: TheorycraftSpellCalculation,
  rankIndex: number,
  stackBonus: number,
  stats: TheorycraftBuildStats,
  rank: number,
  maxRank: number,
  allCalculations: TheorycraftSpellCalculation[],
  stackContext?: TheorycraftStackResolveContext | null
): string {
  const key = calculation.key.toLowerCase()
  if (key === 'critdamage') {
    const totalCalc = allCalculations.find(entry => entry.key.toLowerCase() === 'totaldamage')
    if (totalCalc) {
      const totalStackBonus = stackDamageBonusForCalculation('totaldamage', stackContext, rankIndex)
      const total = computeCalculationValue(totalCalc, stats, rank, maxRank) + totalStackBonus
      const critMult = statValue(stats, 'critDamage')
      if (critMult > 0 && total > 0) {
        return formatResolvedNumber(total * critMult)
      }
    }
  }

  const ratioSuffix = calculation.ratios
    .map(ratio => formatRatioSuffix(ratio, rankIndex, stats))
    .filter(Boolean)
    .join(' ')
  const base = calculation.baseValues[rankIndex]
  const hasBase = Number.isFinite(base)
  const computed = computeCalculationValue(calculation, stats, rank, maxRank) + stackBonus

  if (isPercentLikeCalculation(calculation)) {
    const totalText = formatResolvedNumber(computed)
    if (ratioSuffix) return `${totalText} ${ratioSuffix}`.trim()
    if (hasBase) return formatResolvedNumber(base! + stackBonus)
    return totalText
  }

  if (hasBase && ratioSuffix) {
    const totalBase = formatResolvedNumber(base! + stackBonus)
    return `${totalBase} ${ratioSuffix}`.trim()
  }
  if (hasBase) return formatResolvedNumber(base! + stackBonus)
  if (ratioSuffix) return ratioSuffix
  if (calculation.baseValues.length > 0) {
    const atRank = valueAtRank(calculation.baseValues, rankIndex)
    return atRank == null ? '' : formatResolvedNumber(atRank)
  }
  return formatResolvedNumber(computed)
}

function buildRuntimeVariableMap(
  spell: TheorycraftSpellRuntimeData,
  stats: TheorycraftBuildStats,
  rank: number,
  stackContext?: TheorycraftStackResolveContext | null
): Map<string, string> {
  const maxRank = Math.max(1, spell.maxRank ?? 5)
  const rankIndex = Math.min(Math.max(rank - 1, 0), maxRank - 1)
  const map = new Map<string, string>()

  const setVar = (key: string, value: string) => {
    const normalized = key.toLowerCase()
    map.set(normalized, value)
    const compact = normalized.replace(/[^a-z0-9]/g, '')
    if (compact) map.set(compact, value)
  }

  for (const effect of spell.spellEffects ?? []) {
    setVar(effect.key, formatValueAtRank(effect.values, rankIndex))
    const effectMatch = /^e(\d+)$/i.exec(effect.key)
    if (effectMatch) {
      setVar(`effect${effectMatch[1]}amount`, formatValueAtRank(effect.values, rankIndex))
    }
  }

  for (const entry of spell.dataValues ?? []) {
    setVar(entry.name, formatValueAtRank(entry.values, rankIndex))
    if (entry.name.toLowerCase() === 'basedamage') {
      setVar('effect1amount', formatValueAtRank(entry.values, rankIndex))
    }
  }

  const calculations = spell.calculations ?? []
  for (const calculation of calculations) {
    const stackBonus = stackDamageBonusForCalculation(calculation.key, stackContext, rankIndex)
    const rendered = formatCalculationRenderedValue(
      calculation,
      rankIndex,
      stackBonus,
      stats,
      rank,
      maxRank,
      calculations,
      stackContext
    )
    setVar(calculation.key, rendered)
  }

  applyScalingTooltipAliases(setVar, calculations, stats, rankIndex)

  if (stackContext && stackContext.stackCount > 0) {
    const calculations = resolveStackCalculations(
      stackContext.definition,
      stackContext.calculationsBySource
    )
    applyStackTooltipVariables(
      setVar,
      stackContext.definition,
      calculations,
      stackContext.stackCount,
      rankIndex,
      formatResolvedNumber
    )
  }

  return map
}

function lookupVar(vars: Map<string, string>, expression: string): string | null {
  const base = expression.trim()
  const candidates = new Set<string>([
    base,
    base.toLowerCase(),
    base.replace(/[^a-zA-Z0-9_]/g, ''),
    base.toLowerCase().replace(/[^a-z0-9]/g, ''),
  ])
  for (const candidate of candidates) {
    const value = vars.get(candidate.toLowerCase())
    if (value != null) return value
  }
  return null
}

function resolveExpression(vars: Map<string, string>, expressionRaw: string): string | null {
  const expression = expressionRaw.trim()
  if (!expression) return null

  const direct = lookupVar(vars, expression)
  if (direct != null) return direct

  const normalized = expression.replace(/\s+/g, '')
  const opMatch =
    normalized.match(/^([a-zA-Z0-9_:.-]+)([+\-*/])(-?\d+(?:\.\d+)?)$/) ??
    normalized.match(
      /^([a-zA-Z0-9_:.-]+|[-+]?\d*\.?\d+)([+\-*/])([a-zA-Z0-9_:.-]+|[-+]?\d*\.?\d+)$/
    )
  if (!opMatch) return null

  const leftRaw = opMatch[1]
  const operator = opMatch[2]
  const rightRaw = opMatch[3]
  const leftVar = lookupVar(vars, leftRaw)
  const rightVar = lookupVar(vars, rightRaw)
  const parseNum = (raw: string): number => {
    const trimmed = raw.trim()
    if (/^-\.\d+$/.test(trimmed)) return -Number(`0${trimmed}`)
    if (/^\.\d+$/.test(trimmed)) return Number(`0${trimmed}`)
    return Number(trimmed)
  }
  const leftNum = parseNum(leftRaw)
  const rightNum = parseNum(rightRaw)

  const applyOperation = (left: number, op: string, right: number): number => {
    if (op === '*') return left * right
    if (op === '/') return right === 0 ? 0 : left / right
    if (op === '+') return left + right
    if (op === '-') return left - right
    return left
  }

  const computeSeries = (series: number[], scalar: number, scalarLeft: boolean): string => {
    const computed = series.map(n =>
      scalarLeft ? applyOperation(scalar, operator, n) : applyOperation(n, operator, scalar)
    )
    return formatValueSeries(computed)
  }

  if (leftVar != null && Number.isFinite(rightNum)) {
    const series = parseNumberSeries(leftVar)
    if (series.length > 0) return computeSeries(series, rightNum, false)
    const value = Number(leftVar)
    if (Number.isFinite(value))
      return formatResolvedNumber(applyOperation(value, operator, rightNum))
  }

  if (rightVar != null && Number.isFinite(leftNum)) {
    const series = parseNumberSeries(rightVar)
    if (series.length > 0) return computeSeries(series, leftNum, true)
    const value = Number(rightVar)
    if (Number.isFinite(value))
      return formatResolvedNumber(applyOperation(leftNum, operator, value))
  }

  if (leftVar != null && rightVar != null) {
    const leftSeries = parseNumberSeries(leftVar)
    const rightSeries = parseNumberSeries(rightVar)
    if (leftSeries.length > 0 && rightSeries.length > 0) {
      const len = Math.min(leftSeries.length, rightSeries.length)
      const out: string[] = []
      for (let i = 0; i < len; i += 1) {
        out.push(formatResolvedNumber(applyOperation(leftSeries[i]!, operator, rightSeries[i]!)))
      }
      if (out.length > 0) return formatValueSeries(out.map(Number))
    }
    const lv = Number(leftVar)
    const rv = Number(rightVar)
    if (Number.isFinite(lv) && Number.isFinite(rv)) {
      return formatResolvedNumber(applyOperation(lv, operator, rv))
    }
  }

  if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
    return formatResolvedNumber(applyOperation(leftNum, operator, rightNum))
  }

  return null
}

export function resolveTheorycraftTooltipHtml(
  spell: TheorycraftSpellRuntimeData,
  stats: TheorycraftBuildStats,
  rank: number,
  rawTemplate?: string,
  stackContext?: TheorycraftStackResolveContext | null
): string | null {
  const template = String(rawTemplate ?? spell.tooltipRaw ?? '').trim()
  if (!template) return null

  const vars = buildRuntimeVariableMap(spell, stats, rank, stackContext)
  let parsed = template.replace(/<\s*br\s*\/?>/gi, '___TOOLTIP_BR___')

  parsed = parsed.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression: string) => {
    const resolved = resolveExpression(vars, String(expression))
    if (resolved == null) {
      const exp = expression.trim()
      if (exp.toLowerCase().includes('spellmodifier') || exp.toLowerCase().includes('append')) {
        return ''
      }
      if (exp.includes('{{') || exp.includes('}}')) return ''
      return ''
    }
    return resolved
  })

  parsed = parsed.replace(/___TOOLTIP_BR___/g, '<br />')
  return formatTooltipMarkupHtml(parsed)
}

export function resolveTheorycraftSpellDetailRaws(
  spell: TheorycraftSpellRuntimeData,
  stats: TheorycraftBuildStats | null,
  rank: number,
  stackContext?: TheorycraftStackResolveContext | null
): string[] {
  const statsForResolve: TheorycraftBuildStats = stats ?? {
    level: rank,
    totalAD: 0,
    bonusAD: 0,
    AP: 0,
    totalHP: 0,
    bonusHP: 0,
    armor: 0,
    magicResist: 0,
    maxMana: 0,
    critChance: 0,
    critDamage: 1.75,
    cooldownReduction: 0,
  }

  return (spell.tooltipDetailRaws ?? [])
    .map(raw => resolveTheorycraftTooltipHtml(spell, statsForResolve, rank, raw, stackContext))
    .filter((html): html is string => Boolean(html))
}

export function resolveTheorycraftSpellDescription(
  spell: TheorycraftSpellRuntimeData,
  stats: TheorycraftBuildStats | null,
  rank: number,
  fallbackHtml?: string,
  stackContext?: TheorycraftStackResolveContext | null
): { html: string; isDynamic: boolean } {
  const statsForResolve: TheorycraftBuildStats = stats ?? {
    level: rank,
    totalAD: 0,
    bonusAD: 0,
    AP: 0,
    totalHP: 0,
    bonusHP: 0,
    armor: 0,
    magicResist: 0,
    maxMana: 0,
    critChance: 0,
    critDamage: 1.75,
    cooldownReduction: 0,
  }

  if (spell.tooltipRaw) {
    const dynamic = resolveTheorycraftTooltipHtml(
      spell,
      statsForResolve,
      rank,
      undefined,
      stackContext
    )
    if (dynamic) {
      return { html: dynamic, isDynamic: true }
    }
  }

  return { html: String(fallbackHtml ?? ''), isDynamic: false }
}
