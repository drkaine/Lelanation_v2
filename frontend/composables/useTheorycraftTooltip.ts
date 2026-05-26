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
  displayAsPercent?: boolean
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

function isAdStat(stat: string): boolean {
  const normalized = stat.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized === 'totalad' || normalized === 'bonusad' || normalized === 'attackdamage'
}

function isApStat(stat: string): boolean {
  const normalized = stat.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized === 'ap' || normalized === 'abilitypower' || normalized === 'spelldamage'
}

function formatRatioComponentValue(
  ratio: { stat: string; coefficient: number[] | number },
  rankIndex: number,
  stats: TheorycraftBuildStats,
  useLiveBuildStats = false
): string {
  const coeff = ratioAtRank(ratio.coefficient, rankIndex)
  if (coeff === 0) return ''
  const amount = statValue(stats, ratio.stat) * coeff
  if (useLiveBuildStats || amount > 0) return formatResolvedNumber(amount)
  const pct = formatResolvedNumber(coeff * 100)
  return `${pct}% ${ratioStatDisplayLabel(ratio.stat)}`
}

function findPrimaryDamageCalculation(
  calculations: TheorycraftSpellCalculation[]
): TheorycraftSpellCalculation | undefined {
  const preferred = ['damage', 'totaldamage', 'cast1damage', 'e1damage']
  for (const key of preferred) {
    const found = calculations.find(entry => entry.key.toLowerCase() === key)
    if (found) return found
  }
  return calculations.find(entry => (entry.ratios?.length ?? 0) > 0)
}

function findExtraDamageCalculation(
  calculations: TheorycraftSpellCalculation[]
): TheorycraftSpellCalculation | undefined {
  const preferred = ['miniondamage', 'bonusminiondamage']
  for (const key of preferred) {
    const found = calculations.find(entry => entry.key.toLowerCase() === key)
    if (found) return found
  }
  return undefined
}

function valueFromDataValues(
  dataValues: Array<{ name: string; values: number[] }> | undefined,
  name: string,
  rankIndex: number
): number | null {
  const entry = dataValues?.find(item => item.name.toLowerCase() === name.toLowerCase())
  return entry ? valueAtRank(entry.values, rankIndex) : null
}

function applySplitDamageComponentAliases(
  setVar: (key: string, value: string) => void,
  calculations: TheorycraftSpellCalculation[],
  stats: TheorycraftBuildStats,
  rankIndex: number,
  dataValues?: Array<{ name: string; values: number[] }>,
  useLiveBuildStats = false
): void {
  const applyFromCalculation = (
    calculation: TheorycraftSpellCalculation | undefined,
    suffix: '' | 'extra'
  ) => {
    if (!calculation) return
    for (const ratio of calculation.ratios ?? []) {
      const key =
        suffix === 'extra'
          ? isAdStat(ratio.stat)
            ? 'addamageextra'
            : isApStat(ratio.stat)
              ? 'apdamageextra'
              : null
          : isAdStat(ratio.stat)
            ? 'addamage'
            : isApStat(ratio.stat)
              ? 'apdamage'
              : null
      if (!key) continue
      const rendered = formatRatioComponentValue(ratio, rankIndex, stats, useLiveBuildStats)
      if (rendered) setVar(key, rendered)
    }
  }

  applyFromCalculation(findPrimaryDamageCalculation(calculations), '')
  applyFromCalculation(findExtraDamageCalculation(calculations), 'extra')

  const adRatioValue =
    valueFromDataValues(dataValues, 'tadratio', rankIndex) ??
    valueFromDataValues(dataValues, 'totaladratio', rankIndex) ??
    valueFromDataValues(dataValues, 'passivebadratio', rankIndex)
  if (adRatioValue != null && adRatioValue > 0) {
    const adStat =
      valueFromDataValues(dataValues, 'totaladratio', rankIndex) != null ? 'totalAD' : 'bonusAD'
    const rendered = formatRatioComponentValue(
      { stat: adStat, coefficient: adRatioValue },
      rankIndex,
      stats,
      useLiveBuildStats
    )
    if (rendered) setVar('addamage', rendered)
  }

  const apRatioValue =
    valueFromDataValues(dataValues, 'apratio', rankIndex) ??
    valueFromDataValues(dataValues, 'totalapratio', rankIndex) ??
    valueFromDataValues(dataValues, 'passiveapratio', rankIndex)
  if (apRatioValue != null && apRatioValue > 0) {
    const rendered = formatRatioComponentValue(
      { stat: 'AP', coefficient: apRatioValue },
      rankIndex,
      stats,
      useLiveBuildStats
    )
    if (rendered) setVar('apdamage', rendered)
  }

  const baseDamage = valueFromDataValues(dataValues, 'basedamage', rankIndex)
  if (baseDamage != null) {
    setVar('basedamage1', formatResolvedNumber(baseDamage))
  }

  const passiveSpeed = calculations.find(entry => entry.key.toLowerCase() === 'passivespeedbonus')
  if (passiveSpeed) {
    const base = valueAtRank(passiveSpeed.baseValues, rankIndex)
    if (base != null) {
      const pct = Math.abs(base) <= 1 ? base * 100 : base
      setVar('passivespeedbonus', `${formatResolvedNumber(pct)}%`)
    }
  }
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
  stats: TheorycraftBuildStats,
  useLiveBuildStats = false
): string {
  const coeff = ratioAtRank(ratio.coefficient, rankIndex)
  if (coeff === 0) return ''

  const statAmount = statValue(stats, ratio.stat) * coeff
  const scaleClass = ratioScaleClass(ratio.stat)

  if (useLiveBuildStats || statAmount > 0) {
    return `<span class="tooltip-tag ${scaleClass}">(+ ${formatResolvedNumber(statAmount)})</span>`
  }

  const percentPart = formatRatioPercentSuffix(ratio, rankIndex)
  if (!percentPart) return ''
  return `<span class="tooltip-tag ${scaleClass}">${percentPart}</span>`
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

function calculationShouldDisplayWithPercentSuffix(
  calculation: TheorycraftSpellCalculation
): boolean {
  if (calculation.displayAsPercent === true) return true
  if (calculation.displayAsPercent === false) return false

  const key = calculation.key.toLowerCase()
  if (key.includes('damagecalc') || key.includes('manacalc')) return false
  if (/passivemanacalctooltip|manacalctooltip/.test(key)) return true
  if (
    /attackspeed|attack speed|msbuff|movementspeed|percentms|slowpercent|percenthp|percentmax|percent/.test(
      key
    )
  ) {
    return true
  }
  if (/^pdamage$/i.test(key)) return true
  return false
}

function withPercentSuffix(text: string): string {
  const trimmed = String(text ?? '').trim()
  if (!trimmed || trimmed.endsWith('%')) return trimmed
  return `${trimmed}%`
}

function formatCalculationRenderedValue(
  calculation: TheorycraftSpellCalculation,
  rankIndex: number,
  stackBonus: number,
  stats: TheorycraftBuildStats,
  rank: number,
  maxRank: number,
  allCalculations: TheorycraftSpellCalculation[],
  stackContext?: TheorycraftStackResolveContext | null,
  useLiveBuildStats = false
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
    .map(ratio => formatRatioSuffix(ratio, rankIndex, stats, useLiveBuildStats))
    .filter(Boolean)
    .join(' ')
  const base = calculation.baseValues[rankIndex]
  const hasBase = Number.isFinite(base)
  const computed = computeCalculationValue(calculation, stats, rank, maxRank) + stackBonus

  if (calculationShouldDisplayWithPercentSuffix(calculation)) {
    const needsScale = calculation.displayAsPercent === true && hasBase && Math.abs(base!) < 1
    const scale = needsScale ? 100 : 1
    const totalText = formatResolvedNumber(computed * scale)
    if (ratioSuffix) return `${withPercentSuffix(totalText)} ${ratioSuffix}`.trim()
    if (hasBase) return withPercentSuffix(formatResolvedNumber((base! + stackBonus) * scale))
    return withPercentSuffix(totalText)
  }

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

function applyRecastRampDamageAliases(
  setVar: (key: string, value: string) => void,
  spell: TheorycraftSpellRuntimeData,
  calculations: TheorycraftSpellCalculation[],
  stats: TheorycraftBuildStats,
  rank: number,
  rankIndex: number,
  maxRank: number,
  stackContext?: TheorycraftStackResolveContext | null
): void {
  const rampRaw = valueFromDataValues(spell.dataValues, 'qrampbonus', rankIndex)
  if (rampRaw == null || rampRaw <= 0) return

  const setRamped = (calcKey: string, outKey: string, hitIndex: 2 | 3) => {
    const calculation = calculations.find(entry => entry.key.toLowerCase() === calcKey)
    if (!calculation) return
    const stackBonus = stackDamageBonusForCalculation(calculation.key, stackContext, rankIndex)
    const total = computeCalculationValue(calculation, stats, rank, maxRank) + stackBonus
    const multiplier = (1 + rampRaw) ** (hitIndex - 1)
    setVar(outKey, formatResolvedNumber(total * multiplier))
  }

  setRamped('qdamage', 'qdamage2', 2)
  setRamped('qdamage', 'qdamage3', 3)
  setRamped('qedgedamage', 'qedgedamage2', 2)
  setRamped('qedgedamage', 'qedgedamage3', 3)
}

function appendRecastRampDamageNote(html: string, vars: Map<string, string>): string {
  const secondHit = vars.get('qdamage2')
  const thirdHit = vars.get('qdamage3')
  if (!secondHit || !thirdHit) return html
  if (html.includes(secondHit) && html.includes(thirdHit)) return html
  if (!/r[eé]activ/i.test(html) && !/recast/i.test(html)) return html

  const edgeSecond = vars.get('qedgedamage2')
  const edgeThird = vars.get('qedgedamage3')

  let extra = `<br /><br />2e coup : <physicalDamage>${secondHit}</physicalDamage> pts de dégâts physiques`
  if (edgeSecond) {
    extra += ` (tranchant : <physicalDamage>${edgeSecond}</physicalDamage>)`
  }
  extra += `<br />3e coup : <physicalDamage>${thirdHit}</physicalDamage> pts de dégâts physiques`
  if (edgeThird) {
    extra += ` (tranchant : <physicalDamage>${edgeThird}</physicalDamage>)`
  }
  return html + extra
}

function normalizeTooltipPlainForCompare(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Retire titres client (titleLeft) et aides clavier déjà affichés dans l’UI. */
export function stripClientTooltipChrome(html: string): string {
  return String(html ?? '')
    .replace(/<titleLeft>[\s\S]*?<\/titleLeft>/gi, '')
    .replace(/<titleRight>[\s\S]*?<\/titleRight>/gi, '')
    .replace(/<subtitleLeft>[\s\S]*?<\/subtitleLeft>/gi, '')
    .replace(/<subtitleRight>[\s\S]*?<\/subtitleRight>/gi, '')
    .replace(/<infoArea>[\s\S]*?<\/infoArea>/gi, '')
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim()
}

export function splitTooltipParagraphs(html: string): string[] {
  return stripClientTooltipChrome(html)
    .split(/<br\s*\/?>\s*<br\s*\/?>/gi)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
}

/** Supprime les paragraphes répétés (ex. passif Ornn — forge / chef-d’œuvre). */
export function dedupeTooltipParagraphs(html: string): string {
  const paragraphs = splitTooltipParagraphs(html)
  const unique: string[] = []

  for (const paragraph of paragraphs) {
    const plain = normalizeTooltipPlainForCompare(paragraph)
    if (!plain || plain.length < 8) continue

    let skip = false
    for (let index = 0; index < unique.length; index += 1) {
      const existing = unique[index]!
      const existingPlain = normalizeTooltipPlainForCompare(existing)
      if (existingPlain === plain) {
        skip = true
        break
      }
      if (existingPlain.includes(plain) && plain.length >= 24) {
        skip = true
        break
      }
      if (plain.includes(existingPlain) && existingPlain.length >= 24) {
        unique[index] = paragraph
        skip = true
        break
      }
    }
    if (!skip) unique.push(paragraph)
  }

  return unique.join('<br><br>')
}

function isSupplementalTooltipDuplicate(mainHtml: string, sectionHtml: string): boolean {
  const mainPlain = normalizeTooltipPlainForCompare(mainHtml)
  const sectionPlain = normalizeTooltipPlainForCompare(sectionHtml)
  if (!sectionPlain) return true
  if (!mainPlain) return false
  if (sectionPlain === mainPlain) return true
  if (mainPlain.includes(sectionPlain)) return true
  if (sectionPlain.includes(mainPlain) && mainPlain.length > 80) return true

  const stripDigits = (value: string) =>
    value
      .replace(/\d+(?:[.,]\d+)?/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  const mainCompare = stripDigits(mainPlain)
  const sectionCompare = stripDigits(sectionPlain)
  const prefixLen = Math.min(90, mainCompare.length, sectionCompare.length)
  if (prefixLen >= 50 && mainCompare.slice(0, prefixLen) === sectionCompare.slice(0, prefixLen)) {
    return true
  }

  const sharedOpening = 18
  if (
    mainPlain.length > 80 &&
    sectionPlain.length > 80 &&
    mainPlain.slice(0, sharedOpening) === sectionPlain.slice(0, sharedOpening) &&
    (/r[eé]activ/i.test(mainPlain) || /recast/i.test(mainPlain)) &&
    (/r[eé]activ/i.test(sectionPlain) ||
      /recast/i.test(sectionPlain) ||
      /relanc/i.test(sectionPlain))
  ) {
    return true
  }

  return false
}

export function filterSupplementalTooltipSections(mainHtml: string, sections: string[]): string[] {
  const seen = new Set<string>()
  const accepted: string[] = []
  for (const section of sections) {
    const cleaned = dedupeTooltipParagraphs(stripClientTooltipChrome(section))
    const plain = normalizeTooltipPlainForCompare(cleaned)
    if (!plain || seen.has(plain)) continue
    if (isSupplementalTooltipDuplicate(mainHtml, cleaned)) continue
    if (accepted.some(previous => isSupplementalTooltipDuplicate(previous, cleaned))) continue
    seen.add(plain)
    accepted.push(cleaned)
  }
  return accepted
}

export function shouldShowSupplementalTooltipSummary(
  summaryHtml?: string | null,
  descriptionHtml?: string | null
): boolean {
  const summary = stripClientTooltipChrome(String(summaryHtml ?? '')).trim()
  if (!summary) return false
  const description = stripClientTooltipChrome(String(descriptionHtml ?? '')).trim()
  if (!description) return true
  if (isSupplementalTooltipDuplicate(description, summary)) return false

  const summaryParagraphs = splitTooltipParagraphs(summary).filter(
    paragraph => normalizeTooltipPlainForCompare(paragraph).length >= 20
  )
  if (summaryParagraphs.length === 0) return true

  const descriptionPlain = normalizeTooltipPlainForCompare(description)
  const hasUniqueSummaryParagraph = summaryParagraphs.some(
    paragraph => !descriptionPlain.includes(normalizeTooltipPlainForCompare(paragraph))
  )
  return hasUniqueSummaryParagraph
}

function uniqueSummaryParagraphs(summaryHtml: string, descriptionHtml: string): string {
  const descriptionPlain = normalizeTooltipPlainForCompare(descriptionHtml)
  return splitTooltipParagraphs(summaryHtml)
    .filter(paragraph => {
      const plain = normalizeTooltipPlainForCompare(paragraph)
      return plain.length >= 16 && !descriptionPlain.includes(plain)
    })
    .join('<br><br>')
}

export function finalizeTooltipDisplay(args: {
  summaryHtml?: string | null
  descriptionHtml: string
  detailedTexts?: string[]
}): {
  summaryHtml?: string
  showSummary: boolean
  descriptionHtml: string
  detailedTexts: string[]
} {
  const descriptionHtml = dedupeTooltipParagraphs(stripClientTooltipChrome(args.descriptionHtml))
  const summaryUnique = args.summaryHtml
    ? uniqueSummaryParagraphs(
        dedupeTooltipParagraphs(stripClientTooltipChrome(args.summaryHtml)),
        descriptionHtml
      )
    : ''
  const showSummary =
    Boolean(summaryUnique) && shouldShowSupplementalTooltipSummary(summaryUnique, descriptionHtml)
  const detailedTexts = filterSupplementalTooltipSections(
    descriptionHtml,
    (args.detailedTexts ?? []).map(section => stripClientTooltipChrome(section))
  )

  return {
    summaryHtml: showSummary ? summaryUnique : undefined,
    showSummary,
    descriptionHtml,
    detailedTexts,
  }
}

function buildRuntimeVariableMap(
  spell: TheorycraftSpellRuntimeData,
  stats: TheorycraftBuildStats,
  rank: number,
  stackContext?: TheorycraftStackResolveContext | null,
  useLiveBuildStats = false
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
      stackContext,
      useLiveBuildStats
    )
    setVar(calculation.key, rendered)
  }

  applyScalingTooltipAliases(setVar, calculations, stats, rankIndex)
  applySplitDamageComponentAliases(
    setVar,
    calculations,
    stats,
    rankIndex,
    spell.dataValues,
    useLiveBuildStats
  )
  applyRecastRampDamageAliases(
    setVar,
    spell,
    calculations,
    stats,
    rank,
    rankIndex,
    maxRank,
    stackContext
  )

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
      formatResolvedNumber,
      spell.dataValues
    )
  }

  return map
}

function lookupVar(vars: Map<string, string>, expression: string): string | null {
  const base = expression.trim()
  const lower = base.toLowerCase()
  const candidates = new Set<string>([
    base,
    lower,
    base.replace(/[^a-zA-Z0-9_]/g, ''),
    lower.replace(/[^a-z0-9]/g, ''),
  ])

  const baseWithoutDecimalSuffix = lower.replace(/\.\d+$/, '')
  if (baseWithoutDecimalSuffix !== lower) {
    candidates.add(baseWithoutDecimalSuffix)
    candidates.add(baseWithoutDecimalSuffix.replace(/[^a-z0-9]/g, ''))
  }

  const colonIndex = lower.lastIndexOf(':')
  if (colonIndex >= 0 && colonIndex < lower.length - 1) {
    const tail = lower.slice(colonIndex + 1)
    candidates.add(tail)
    candidates.add(tail.replace(/[^a-z0-9]/g, ''))
  }

  const dotIndex = lower.lastIndexOf('.')
  if (dotIndex >= 0 && dotIndex < lower.length - 1) {
    const tail = lower.slice(dotIndex + 1)
    candidates.add(tail)
    candidates.add(tail.replace(/[^a-z0-9]/g, ''))
  }

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
  stackContext?: TheorycraftStackResolveContext | null,
  useLiveBuildStats = false
): string | null {
  const template = String(rawTemplate ?? spell.tooltipRaw ?? '')
    .trim()
    .replace(/@([a-zA-Z0-9_.:]+(?:\*[.\d-]+)?)@/gi, '{{ $1 }}')
  if (!template) return null

  const vars = buildRuntimeVariableMap(spell, stats, rank, stackContext, useLiveBuildStats)
  let parsed = template.replace(/<\s*br\s*\/?>/gi, '___TOOLTIP_BR___')

  let unresolvedVars = 0
  parsed = parsed.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression: string) => {
    const exp = expression.trim()
    if (exp.toLowerCase().includes('spellmodifier') || exp.toLowerCase().includes('append')) {
      return ''
    }
    const resolved = resolveExpression(vars, String(expression))
    if (resolved == null) {
      if (exp.includes('{{') || exp.includes('}}')) return ''
      unresolvedVars++
      return ''
    }
    return resolved
  })

  if (unresolvedVars > 0) return null

  parsed = parsed.replace(/___TOOLTIP_BR___/g, '<br />')
  const formatted = formatTooltipMarkupHtml(parsed)
  return appendRecastRampDamageNote(formatted, vars)
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

  const useLiveBuildStats = stats != null

  return (spell.tooltipDetailRaws ?? [])
    .map(raw =>
      resolveTheorycraftTooltipHtml(
        spell,
        statsForResolve,
        rank,
        raw,
        stackContext,
        useLiveBuildStats
      )
    )
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
    const useLiveBuildStats = stats != null
    const dynamic = resolveTheorycraftTooltipHtml(
      spell,
      statsForResolve,
      rank,
      undefined,
      stackContext,
      useLiveBuildStats
    )
    if (dynamic) {
      return { html: dynamic, isDynamic: true }
    }
  }

  return { html: String(fallbackHtml ?? ''), isDynamic: false }
}
