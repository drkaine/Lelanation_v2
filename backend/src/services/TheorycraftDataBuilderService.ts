import { createHash } from 'crypto'
import { join, relative } from 'path'
import { promises as fs } from 'fs'
import { fetchJson, HttpRequestError } from '../utils/httpFetch.js'
import { FileManager } from '../utils/fileManager.js'
import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { DataDragonService } from './DataDragonService.js'

type ChampionSpell = Record<string, unknown>
type ChampionRecord = Record<string, unknown>
type CDragonChampionSpell = Record<string, unknown>
type CDragonChampion = Record<string, unknown>
type CDragonItem = Record<string, unknown>
type CDragonPerk = Record<string, unknown>
type ChampionBinJson = Record<string, Record<string, unknown>>

const SUPPORTED_LANGS = ['fr_FR', 'en_US'] as const
const SCHEMA_VERSION = 2
const CDRAGON_BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global'
const CDRAGON_HASHES_URL = 'https://raw.communitydragon.org/data/hashes/lol/hashes.game.txt'

function toGameDataLocale(lang: string): string {
  const normalized = lang.trim().toLowerCase().replace('-', '_')
  return normalized === 'fr_fr' ? 'fr_fr' : 'en_us'
}

function cdragonStringTableUrl(lang: string): string {
  const gameLocale = toGameDataLocale(lang)
  return `https://raw.communitydragon.org/latest/game/${gameLocale}/data/menu/en_us/lol.stringtable.json`
}

const TOOLTIP_TAG_MAP: Record<string, { className: string; icon?: string }> = {
  physicaldamage: { className: 'dmg-physical', icon: 'physical' },
  magicdamage: { className: 'dmg-magic', icon: 'magic' },
  truedamage: { className: 'dmg-true', icon: 'true' },
  healing: { className: 'healing', icon: 'heal' },
  shield: { className: 'shield', icon: 'shield' },
  speed: { className: 'speed', icon: 'speed' },
  attackspeed: { className: 'tooltip-tag tooltip-tag-attackspeed' },
  status: { className: 'status-cc' },
  recast: { className: 'recast' },
  passive: { className: 'passive' },
  active: { className: 'active' },
  keywordmajor: { className: 'keyword-major' },
  keyword: { className: 'keyword' },
  keywordstealth: { className: 'keyword-stealth' },
  spellname: { className: 'spell-name' },
  spellactive: { className: 'active' },
  spellpassive: { className: 'passive' },
  rules: { className: 'tooltip-rules' },
  onhit: { className: 'on-hit' },
  true: { className: 'dmg-true', icon: 'true' },
  scalead: { className: 'tooltip-tag scale-ad' },
  scaleap: { className: 'tooltip-tag scale-ap' },
  scalearmor: { className: 'tooltip-tag scale-armor' },
  scalemr: { className: 'tooltip-tag scale-mr' },
  scalemana: { className: 'tooltip-tag scale-mana' },
  scalehealth: { className: 'tooltip-tag scale-hp' },
}

const RATIO_STAT_MAP: Record<string, string> = {
  attackdamage: 'totalAD',
  totalattackdamage: 'totalAD',
  bonusattackdamage: 'bonusAD',
  bonusad: 'bonusAD',
  totalad: 'totalAD',
  spelldamage: 'AP',
  abilitypower: 'AP',
  ap: 'AP',
  hp: 'totalHP',
  health: 'totalHP',
  bonushealth: 'bonusHP',
  bonushp: 'bonusHP',
  armor: 'armor',
  bonusarmor: 'bonusArmor',
  armorratio: 'bonusArmor',
  mrratio: 'bonusMagicResist',
  spellblock: 'magicResist',
  bonusspellblock: 'bonusMagicResist',
  mana: 'maxMana',
}

const BIN_STAT_MAP: Record<number, string> = {
  0: 'AP',
  1: 'bonusArmor',
  2: 'totalAD',
  3: 'armor',
  4: 'magicResist',
  5: 'bonusAD',
  6: 'bonusMagicResist',
  8: 'critChance',
  9: 'critDamage',
  10: 'maxMana',
  11: 'totalHP',
  12: 'bonusHP',
}

/** Baseline stats for bin tooltip previews (0% crit → base headshot ratios only). */
const DEFAULT_BIN_STAT_VALUES: Record<string, number> = {
  critChance: 0,
  critDamage: 1.75,
  totalAD: 1,
  bonusAD: 0,
  AP: 0,
}

function defaultBinStatValue(stat: string): number {
  return DEFAULT_BIN_STAT_VALUES[stat] ?? 0
}

const APHELIOS_WEAPON_KEYS = [
  'Calibrum',
  'Severum',
  'Infernum',
  'Crescendum',
  'Gravitum',
] as const

/** Bin mStat index → stat key; omitted mStat defaults to AP (e.g. Lee Sin W shield). */
function resolveBinStat(rawStat: unknown, fallback: string = 'AP'): string {
  if (rawStat == null || rawStat === '') return fallback
  const statId = Number(rawStat)
  if (!Number.isFinite(statId) || statId < 0) return fallback
  return BIN_STAT_MAP[statId] ?? fallback
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function parseNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => Number(v)).filter((v) => Number.isFinite(v))
}

function normalizeSpellSlot(index: number): 'Q' | 'W' | 'E' | 'R' {
  return (['Q', 'W', 'E', 'R'][index] ?? 'Q') as 'Q' | 'W' | 'E' | 'R'
}

function toCDragonLocale(lang: string): string {
  if (lang === 'fr_FR') return 'fr_fr'
  if (lang === 'en_US') return 'default'
  return lang.toLowerCase()
}

function normalizeTooltipPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
}

function normalizeChampionBinId(championId: string): string {
  return championId.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function toSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function formatResolvedNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  const precision = abs > 0 && abs < 1 ? 4 : 2
  const fixed = Number(value.toFixed(precision))
  return Number.isInteger(fixed) ? String(fixed) : String(fixed).replace(/\.?0+$/, '')
}

/** Collapse 40/40/40/40/40 → 40; otherwise join with separator (default "/"). */
function formatValueSeries(values: number[], separator = '/'): string {
  if (!values.length) return ''
  const formatted = values.map((v) => formatResolvedNumber(v))
  if (formatted.every((v) => v === formatted[0])) return formatted[0]
  return formatted.join(separator)
}

function ratioStatDisplayLabel(stat: string): string {
  const labels: Record<string, string> = {
    totalAD: 'AD',
    bonusAD: 'AD',
    AP: 'AP',
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

function ratioScaleClass(stat: string): string | null {
  if (stat === 'bonusArmor' || stat === 'armor') return 'scale-armor'
  if (stat === 'bonusMagicResist' || stat === 'magicResist') return 'scale-mr'
  if (stat === 'totalAD' || stat === 'bonusAD') return 'scale-ad'
  if (stat === 'AP') return 'scale-ap'
  if (stat === 'maxMana') return 'scale-mana'
  if (stat === 'totalHP' || stat === 'bonusHP') return 'scale-hp'
  return null
}

function formatRatioSuffix(
  ratio: {
    stat: string
    coefficient: number[]
  },
  options?: { html?: boolean }
): string {
  const coeffs = ratio.coefficient.filter((c) => Number.isFinite(c) && c !== 0)
  if (coeffs.length === 0) return ''
  if (ratio.stat === 'critDamage') {
    const pct = formatValueSeries(coeffs.map((c) => (c <= 1 ? c * 100 : c)))
    const text = `${pct}%`
    return options?.html ? `<span class="tooltip-tag tooltip-tag-crit">${text}</span>` : text
  }
  const statLabel = ratioStatDisplayLabel(ratio.stat)
  let text = ''
  if (coeffs.every((c) => c === coeffs[0])) {
    const pct = formatResolvedNumber(coeffs[0] * 100)
    text = `(+ ${pct}% ${statLabel})`
  } else {
    const pctSeries = formatValueSeries(
      coeffs.map((c) => c * 100),
      ' / '
    )
    text = `(+ ${pctSeries}% ${statLabel})`
  }
  if (!options?.html) return text
  const scaleClass = ratioScaleClass(ratio.stat)
  if (!scaleClass) return text
  return `<span class="tooltip-tag ${scaleClass}">${text}</span>`
}

function ratioTypeForStat(stat: string): 'physical' | 'magic' | 'true' {
  if (stat === 'totalAD' || stat === 'bonusAD') return 'physical'
  return 'magic'
}

function parseNumberSeries(raw: string): number[] {
  return raw
    .split('/')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n))
}

const DEFAULT_ABILITY_MAX_RANK = 5

function trimByMaxRank(values: number[], maxRank?: number): number[] {
  if (!Array.isArray(values) || values.length === 0) return []
  const rank = Number(maxRank ?? 0)
  if (!Number.isFinite(rank) || rank <= 0) {
    // CDragon/bin arrays often include a leading rank-0 slot (e.g. BaseDamage: -5, 20, 45…).
    if (values.length > DEFAULT_ABILITY_MAX_RANK) return values.slice(1)
    return values
  }
  const limit = Math.max(1, Math.trunc(rank))
  // Skip rank-0 slot when the array is longer than the ability max rank.
  const offset = values.length > limit ? 1 : 0
  return values.slice(offset, offset + limit)
}

const MAX_CHAMPION_LEVEL = 18
/** Innate passives scale at these champion levels (not ability rank). */
const PASSIVE_CHAMPION_LEVELS = [1, 5, 9, 13, 17] as const
const ABILITY_RANK_CHAMPION_LEVELS: number[][] = [
  [1, 3, 5, 7, 9],
  [3, 5, 7, 9, 11],
  [4, 6, 8, 10, 12],
  [6, 11, 16],
]

function inferSpellSlotIndex(ddSpell: ChampionSpell): number {
  const id = String(ddSpell.id ?? '').toUpperCase()
  if (id.endsWith('W')) return 1
  if (id.endsWith('E')) return 2
  if (id.endsWith('R')) return 3
  return 0
}

function championLevelForAbilityRank(slotIndex: number, rank: number): number {
  const levels = ABILITY_RANK_CHAMPION_LEVELS[slotIndex] ?? ABILITY_RANK_CHAMPION_LEVELS[0]
  return levels[Math.min(Math.max(rank - 1, 0), levels.length - 1)] ?? rank
}

function championLevelForCalculationRank(options: BinCalculationBuildOptions, rank: number): number {
  if (options.isPassive) {
    return PASSIVE_CHAMPION_LEVELS[Math.min(Math.max(rank - 1, 0), PASSIVE_CHAMPION_LEVELS.length - 1)] ?? rank
  }
  return championLevelForAbilityRank(options.slotIndex ?? 0, rank)
}

function interpolateByCharLevel(start: number, end: number, level: number): number {
  const clamped = Math.min(Math.max(level, 1), MAX_CHAMPION_LEVEL)
  if (MAX_CHAMPION_LEVEL <= 1) return start
  return start + (end - start) * (clamped - 1) / (MAX_CHAMPION_LEVEL - 1)
}

type BinCalculationBuildOptions = {
  htmlRatios?: boolean
  maxRank?: number
  slotIndex?: number
  /** Innate passives use PASSIVE_CHAMPION_LEVELS instead of ability rank → level mapping. */
  isPassive?: boolean
  displayAsPercent?: boolean
  precision?: number
  binSpell?: Record<string, unknown>
  ddSpell?: ChampionSpell
}

function extractBinEffectAmountValues(
  binSpell: Record<string, unknown>,
  effectIndex: number,
  maxRank?: number
): number[] {
  const raw = binSpell.mEffectAmount
  if (!Array.isArray(raw) || effectIndex < 0) return []
  const readAt = (idx: number): number[] => {
    if (idx < 0 || idx >= raw.length) return []
    const entry = asObject(raw[idx])
    return trimByMaxRank(parseNumberArray(entry.value), maxRank)
  }
  const direct = readAt(effectIndex)
  if (direct.length > 0) return direct
  return readAt(effectIndex - 1)
}

function extractDDragonEffectValues(
  ddSpell: ChampionSpell | undefined,
  effectIndex: number,
  maxRank?: number
): number[] {
  const ddEffect = ddSpell?.effect
  if (!Array.isArray(ddEffect) || effectIndex < 0 || effectIndex >= ddEffect.length) return []
  return trimByMaxRank(parseNumberArray(ddEffect[effectIndex]), maxRank)
}

function resolveEffectValueSeries(
  effectIndex: number,
  options: BinCalculationBuildOptions
): number[] {
  const maxRank = Number(options.maxRank ?? DEFAULT_ABILITY_MAX_RANK)
  const fromDd = extractDDragonEffectValues(options.ddSpell, effectIndex, maxRank)
  if (fromDd.length > 0) return fromDd
  const binSpell = asObject(options.binSpell)
  return extractBinEffectAmountValues(binSpell, effectIndex, maxRank)
}

function breakpointUsesAdditiveBonus(part: Record<string, unknown>): boolean {
  const breakpoints = Array.isArray(part.mBreakpoints) ? part.mBreakpoints : []
  return breakpoints.some((raw) => {
    const bp = asObject(raw)
    return bp.mAdditionalBonusAtThisLevel != null
  })
}

function bonusPerLevelAtCharLevel(part: Record<string, unknown>, level: number): number {
  let bonus = Number(part.mInitialBonusPerLevel ?? part.mBonusPerLevel ?? 0)
  const breakpoints = Array.isArray(part.mBreakpoints) ? part.mBreakpoints : []
  for (const raw of breakpoints) {
    const bp = asObject(raw)
    if (level >= Number(bp.mLevel ?? 0) && bp.mBonusPerLevelAtAndAfter != null) {
      bonus = Number(bp.mBonusPerLevelAtAndAfter)
    }
  }
  return bonus
}

function valueAtCharLevelFromBreakpoints(part: Record<string, unknown>, level: number): number {
  if (breakpointUsesAdditiveBonus(part)) {
    let value = Number(part.mLevel1Value ?? 0)
    const breakpoints = Array.isArray(part.mBreakpoints) ? part.mBreakpoints : []
    for (const raw of breakpoints) {
      const bp = asObject(raw)
      if (level >= Number(bp.mLevel ?? 0)) {
        value += Number(bp.mAdditionalBonusAtThisLevel ?? 0)
      }
    }
    return value
  }
  const start = Number(part.mLevel1Value ?? 0)
  let total = start
  for (let charLevel = 2; charLevel <= level; charLevel += 1) {
    total += bonusPerLevelAtCharLevel(part, charLevel)
  }
  return total
}

function renderByCharLevelBreakpointsSeries(
  part: Record<string, unknown>,
  options: BinCalculationBuildOptions
): { values: number[]; text: string } {
  const maxRank = Math.max(1, Number(options.maxRank ?? 5))
  const precision = Number(options.precision ?? 2)
  const displayAsPercent = Boolean(options.displayAsPercent)
  const values: number[] = []
  for (let rank = 1; rank <= maxRank; rank += 1) {
    const level = championLevelForCalculationRank(options, rank)
    let value = valueAtCharLevelFromBreakpoints(part, level)
    if (displayAsPercent) value *= 100
    if (Number.isFinite(precision) && precision >= 0) {
      value = Number(value.toFixed(precision))
    }
    values.push(value)
  }
  const series = formatValueSeries(values, ' / ')
  return { values, text: displayAsPercent && series ? `${series}%` : series }
}

function renderByCharLevelFormulaSeries(
  part: Record<string, unknown>,
  options: BinCalculationBuildOptions
): { values: number[]; text: string } {
  const maxRank = Math.max(1, Number(options.maxRank ?? 5))
  const precision = Number(options.precision ?? 2)
  const displayAsPercent = Boolean(options.displayAsPercent)
  const allValues = trimByMaxRank(parseNumberArray(part.values), MAX_CHAMPION_LEVEL)
  const values: number[] = []
  for (let rank = 1; rank <= maxRank; rank += 1) {
    const level = championLevelForCalculationRank(options, rank)
    let value = allValues[Math.min(Math.max(level - 1, 0), allValues.length - 1)] ?? 0
    if (displayAsPercent) value *= 100
    if (Number.isFinite(precision) && precision >= 0) {
      value = Number(value.toFixed(precision))
    }
    values.push(value)
  }
  const series = formatValueSeries(values, ' / ')
  return { values, text: displayAsPercent && series ? `${series}%` : series }
}

function formatCalculationValuesAsText(
  values: number[],
  options: BinCalculationBuildOptions
): string {
  if (values.length === 0) return ''
  const series = formatValueSeries(values, ' / ')
  return options.displayAsPercent && series ? `${series}%` : series
}

function findCalculationByKey(
  calculations: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const normalized = key.toLowerCase()
  if (calculations[normalized]) return asObject(calculations[normalized])
  if (calculations[key]) return asObject(calculations[key])
  for (const [calcKey, raw] of Object.entries(calculations)) {
    if (calcKey.toLowerCase() === normalized) return asObject(raw)
  }
  return null
}

function resolveReferencedCalculationValues(
  calculationKey: string,
  dataValues: Array<{ name: string; values: number[] }>,
  options: BinCalculationBuildOptions
): number[] {
  const calculations = asObject(options.binSpell?.mSpellCalculations)
  const ref = findCalculationByKey(calculations, calculationKey)
  if (!ref) return []

  const refType = String(ref.__type ?? '')
  if (refType === 'GameCalculationConditional') {
    const namedRef = String(ref.mConditionalGameCalculation ?? ref.mDefaultGameCalculation ?? '')
    if (namedRef) {
      return resolveReferencedCalculationValues(namedRef, dataValues, options)
    }
    return []
  }

  const parts = Array.isArray(ref.mFormulaParts) ? ref.mFormulaParts : []
  if (parts.length === 0) return []
  const built = buildBinCalculationExpression(parts, dataValues, options)
  return built.baseValues.length > 0
    ? built.baseValues
    : parseNumberSeries(built.expression)
}

function scaleCalculationValues(
  values: number[],
  multiplier: number[],
  precision: number
): number[] {
  if (values.length === 0) return []
  return values.map((value, index) => {
    const mult = multiplier[Math.min(index, multiplier.length - 1)] ?? multiplier[0] ?? 1
    let scaled = value * mult
    if (Number.isFinite(precision) && precision >= 0) {
      scaled = Number(scaled.toFixed(precision))
    }
    return scaled
  })
}

function renderByCharLevelInterpolationSeries(
  part: Record<string, unknown>,
  options: BinCalculationBuildOptions
): { values: number[]; text: string } {
  const maxRank = Math.max(1, Number(options.maxRank ?? 5))
  const start = Number(part.mStartValue ?? 0)
  const end = Number(part.mEndValue ?? 0)
  const precision = Number(options.precision ?? 2)
  const displayAsPercent = Boolean(options.displayAsPercent)
  const values: number[] = []
  for (let rank = 1; rank <= maxRank; rank += 1) {
    const level = championLevelForCalculationRank(options, rank)
    let value = interpolateByCharLevel(start, end, level)
    if (displayAsPercent) value *= 100
    if (Number.isFinite(precision) && precision >= 0) {
      value = Number(value.toFixed(precision))
    }
    values.push(value)
  }
  const series = formatValueSeries(values, ' / ')
  return { values, text: displayAsPercent && series ? `${series}%` : series }
}

function multiplyValueSeries(series: number[][]): number[] {
  if (series.length === 0) return []
  const limit = Math.max(...series.map((entry) => entry.length))
  const out: number[] = []
  for (let i = 0; i < limit; i += 1) {
    let product = 1
    for (const entry of series) {
      if (entry.length === 0) continue
      const value = entry[Math.min(i, entry.length - 1)]
      product *= Number.isFinite(value) ? value : 0
    }
    out.push(product)
  }
  return out
}

function evaluateCalculationPartValues(
  part: Record<string, unknown>,
  dataValues: Array<{ name: string; values: number[] }>,
  options: BinCalculationBuildOptions
): number[] {
  const partType = String(part.__type ?? '')
  const binSpell = options.binSpell ?? {}
  const maxRank = Number(options.maxRank ?? 5)

  if (partType === 'NamedDataValueCalculationPart') {
    return firstValuesFromDataValues(dataValues, String(part.mDataValue ?? '')) ?? []
  }
  if (partType === 'BuffCounterByCoefficientCalculationPart') {
    const coeff = Number(part.mCoefficient ?? 0)
    const dataValueName = String(part.mDataValue ?? '')
    if (dataValueName) {
      const values = firstValuesFromDataValues(dataValues, dataValueName)
      if (!values || values.length === 0) return []
      return coeff !== 0 && Number.isFinite(coeff) ? values.map((v) => v * coeff) : values
    }
    return Number.isFinite(coeff) ? Array.from({ length: maxRank }, () => 0) : []
  }
  if (partType === 'BuffCounterByNamedDataValueCalculationPart') {
    const values = firstValuesFromDataValues(dataValues, String(part.mDataValue ?? ''))
    if (!values || values.length === 0) return []
    const coeff = Number(part.mCoefficient ?? 1)
    return Number.isFinite(coeff) && coeff !== 1 ? values.map((v) => v * coeff) : values
  }
  if (part.mSpellCalculationKey) {
    return resolveReferencedCalculationValues(String(part.mSpellCalculationKey), dataValues, options)
  }
  if (partType === 'CooldownMultiplierCalculationPart') {
    const innerParts = Array.isArray(part.mFormulaParts) ? part.mFormulaParts : []
    if (innerParts.length > 0) {
      return evaluateCalculationPartValues(asObject(innerParts[0]), dataValues, options)
    }
    return []
  }
  if (partType === 'NumberCalculationPart') {
    const value = Number(part.mNumber ?? 0)
    return Number.isFinite(value) ? Array.from({ length: maxRank }, () => value) : []
  }
  if (partType === 'ByCharLevelInterpolationCalculationPart') {
    return renderByCharLevelInterpolationSeries(part, options).values
  }
  if (partType === 'ByCharLevelBreakpointsCalculationPart') {
    return renderByCharLevelBreakpointsSeries(part, options).values
  }
  if (partType === 'ByCharLevelFormulaCalculationPart') {
    return renderByCharLevelFormulaSeries(part, options).values
  }
  if (partType === 'EffectValueCalculationPart') {
    const effectIndex = Number(part.mEffectIndex ?? -1)
    return resolveEffectValueSeries(effectIndex, { ...options, binSpell, maxRank })
  }
  if (partType === 'ClampSubPartsCalculationPart') {
    const subparts = Array.isArray(part.mSubparts) ? part.mSubparts : []
    const series = subparts
      .map((subpart) => evaluateCalculationPartValues(asObject(subpart), dataValues, options))
      .filter((entry) => entry.length > 0)
    const merged = series.length === 1 ? series[0] : multiplyValueSeries(series)
    const floor = Number(part.mFloor ?? Number.NEGATIVE_INFINITY)
    const ceiling = Number(part.mCeiling ?? Number.POSITIVE_INFINITY)
    return merged.map((value) => Math.min(ceiling, Math.max(floor, value)))
  }
  if (partType === 'ProductOfSubPartsCalculationPart') {
    const subparts = Array.isArray(part.mSubparts)
      ? part.mSubparts
      : [part.mPart1, part.mPart2].filter(Boolean)
    const series = subparts
      .map((subpart) => evaluateCalculationPartValues(asObject(subpart), dataValues, options))
      .filter((entry) => entry.length > 0)
    return multiplyValueSeries(series)
  }
  if (partType === 'SumOfSubPartsCalculationPart') {
    const subparts = Array.isArray(part.mSubparts)
      ? part.mSubparts
      : [part.mPart1, part.mPart2].filter(Boolean)
    const series = subparts
      .map((subpart) => evaluateCalculationPartValues(asObject(subpart), dataValues, options))
      .filter((entry) => entry.length > 0)
    if (series.length === 0) return []
    const limit = Math.max(...series.map((entry) => entry.length))
    const out: number[] = []
    for (let i = 0; i < limit; i += 1) {
      let sum = 0
      for (const entry of series) {
        sum += entry[Math.min(i, entry.length - 1)] ?? 0
      }
      out.push(sum)
    }
    return out
  }
  if (partType === 'StatByCoefficientCalculationPart') {
    const stat = resolveBinStat(part.mStat, 'AP')
    const coeff = Number(part.mCoefficient ?? 1)
    if (!Number.isFinite(coeff)) return []
    const statValue = defaultBinStatValue(stat)
    return Array.from({ length: maxRank }, () => statValue * coeff)
  }
  if (partType === 'StatByNamedDataValueCalculationPart') {
    const stat = resolveBinStat(part.mStat, 'AP')
    const dvValues = firstValuesFromDataValues(dataValues, String(part.mDataValue ?? ''))
    const coeffSeries =
      dvValues && dvValues.length > 0
        ? trimByMaxRank(dvValues, maxRank)
        : Array.from({ length: maxRank }, () => 1)
    const statValue = defaultBinStatValue(stat)
    return coeffSeries.map((coeff) => statValue * coeff)
  }
  if (partType === 'StatBySubPartCalculationPart') {
    const subpart = asObject(part.mSubpart)
    return evaluateCalculationPartValues(subpart, dataValues, options)
  }
  return []
}

function applyOperation(left: number, operator: string, right: number): number {
  if (operator === '*') return left * right
  if (operator === '/') return right === 0 ? 0 : left / right
  if (operator === '+') return left + right
  if (operator === '-') return left - right
  return left
}

function stableStringify(value: unknown): string {
  if (value == null) return JSON.stringify(value)
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

function mapRatioStat(rawKey: string): string {
  const normalized = rawKey.replace(/[^a-zA-Z]/g, '').toLowerCase()
  return RATIO_STAT_MAP[normalized] ?? 'AP'
}

function firstValuesFromDataValues(
  dataValues: Array<{ name: string; values: number[] }>,
  key: string
): number[] | null {
  const normalized = key.toLowerCase()
  for (const value of dataValues) {
    if (value.name.toLowerCase() === normalized) {
      return value.values
    }
  }
  return null
}

function extractBinDataValues(
  binSpell: Record<string, unknown>,
  maxRank?: number
): Array<{ name: string; values: number[] }> {
  const raw = binSpell.DataValues
  if (!Array.isArray(raw)) return []
  const resolvedRank = Number(maxRank ?? DEFAULT_ABILITY_MAX_RANK) || DEFAULT_ABILITY_MAX_RANK
  return raw
    .map((entry) => {
      const obj = asObject(entry)
      return {
        name: String(obj.name ?? ''),
        values: trimByMaxRank(parseNumberArray(obj.values), resolvedRank),
      }
    })
    .filter((v) => v.name.length > 0 && v.values.length > 0)
}

function extractRatioFromCalculationPart(
  part: Record<string, unknown>,
  dataValues: Array<{ name: string; values: number[] }>,
  options?: BinCalculationBuildOptions
): { stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' } | null {
  const partType = String(part.__type ?? '')
  if (partType === 'AbilityResourceByCoefficientCalculationPart') {
    const coeffRaw = Number(part.mCoefficient ?? 0)
    if (!Number.isFinite(coeffRaw) || coeffRaw === 0) return null
    const coeff = Number(formatResolvedNumber(coeffRaw))
    return { stat: 'maxMana', coefficient: [coeff], type: 'magic' }
  }
  if (partType === 'StatBySubPartCalculationPart') {
    const subpart = asObject(part.mSubpart)
    const values = evaluateCalculationPartValues(subpart, dataValues, options ?? {})
    if (values.length === 0) return null
    const stat = resolveBinStat(part.mStat, 'totalAD')
    return { stat, coefficient: values, type: ratioTypeForStat(stat) }
  }
  if (partType === 'StatByCoefficientCalculationPart') {
    const coeffRaw = Number(part.mCoefficient ?? 0)
    if (!Number.isFinite(coeffRaw) || coeffRaw === 0) return null
    const coeff = Number(formatResolvedNumber(coeffRaw))
    const stat = resolveBinStat(part.mStat, 'AP')
    return { stat, coefficient: [coeff], type: ratioTypeForStat(stat) }
  }
  if (partType === 'StatByNamedDataValueCalculationPart') {
    const values = firstValuesFromDataValues(dataValues, String(part.mDataValue ?? ''))
    if (!values || values.length === 0) return null
    const dataValueName = String(part.mDataValue ?? '').toLowerCase()
    if (dataValueName.startsWith('astoad') || dataValueName.startsWith('astoap')) {
      return null
    }
    if (
      dataValueName.includes('percentmana') ||
      dataValueName.includes('manaincrease') ||
      (dataValueName.includes('percent') && !dataValueName.includes('ad') && !dataValueName.includes('ap'))
    ) {
      return null
    }
    let stat = resolveBinStat(part.mStat, 'AP')
    if (dataValueName.includes('armor')) stat = 'bonusArmor'
    else if (dataValueName.includes('mr') || dataValueName.includes('magicresist')) stat = 'bonusMagicResist'
    else if (dataValueName.includes('health') || dataValueName.includes('hp')) stat = 'bonusHP'
    else if (dataValueName.includes('ad') || dataValueName.includes('attackdamage')) stat = 'bonusAD'
    else if (dataValueName.includes('ap') || dataValueName.includes('spelldamage')) stat = 'AP'
    const type: 'physical' | 'magic' | 'true' = dataValueName.includes('ad') ? 'physical' : 'magic'
    return { stat, coefficient: values, type }
  }
  return null
}

function buildBinCalculationExpression(
  parts: unknown[],
  dataValues: Array<{ name: string; values: number[] }>,
  options?: BinCalculationBuildOptions
): {
  expression: string
  baseValues: number[]
  ratios: Array<{ stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' }>
} {
  let baseValues: number[] = []
  const baseParts: string[] = []
  const numericBaseSeries: number[][] = []
  const ratios: Array<{ stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' }> = []

  for (const rawPart of parts) {
    const part = asObject(rawPart)
    const partType = String(part.__type ?? '')
    if (part.mSpellCalculationKey) {
      const values = resolveReferencedCalculationValues(String(part.mSpellCalculationKey), dataValues, options ?? {})
      if (values.length > 0) {
        baseValues = values
        baseParts.push(formatCalculationValuesAsText(values, options ?? {}) || formatValueSeries(values, ' / '))
      }
      continue
    }
    if (partType === 'NamedDataValueCalculationPart') {
      const values = firstValuesFromDataValues(dataValues, String(part.mDataValue ?? ''))
      if (values && values.length > 0) {
        baseValues = values
        baseParts.push(formatValueSeries(values, ' / '))
        numericBaseSeries.push(values)
      }
      continue
    }
    if (partType === 'BuffCounterByCoefficientCalculationPart') {
      const coeff = Number(part.mCoefficient ?? 0)
      const dataValueName = String(part.mDataValue ?? '')
      if (dataValueName) {
        const values = firstValuesFromDataValues(dataValues, dataValueName)
        if (values && values.length > 0) {
          const scaled =
            coeff !== 0 && Number.isFinite(coeff) ? values.map((v) => v * coeff) : values
          baseValues = scaled
          baseParts.push(formatValueSeries(scaled, ' / '))
          numericBaseSeries.push(scaled)
        }
      } else if (Number.isFinite(coeff) && coeff !== 0) {
        const pct = formatResolvedNumber(coeff * 100)
        baseParts.push(`(+ ${pct}% per mark)`)
      }
      continue
    }
    if (partType === 'BuffCounterByNamedDataValueCalculationPart') {
      const values = firstValuesFromDataValues(dataValues, String(part.mDataValue ?? ''))
      if (values && values.length > 0) {
        const coeff = Number(part.mCoefficient ?? 1)
        const scaled =
          Number.isFinite(coeff) && coeff !== 1 ? values.map((v) => v * coeff) : values
        baseValues = scaled
        baseParts.push(formatValueSeries(scaled, ' / '))
        numericBaseSeries.push(scaled)
      }
      continue
    }
    if (partType === 'ByCharLevelInterpolationCalculationPart') {
      const rendered = renderByCharLevelInterpolationSeries(part, options ?? {})
      if (rendered.values.length > 0) {
        baseValues = rendered.values
        baseParts.push(rendered.text)
        numericBaseSeries.push(rendered.values)
      }
      continue
    }
    if (partType === 'ByCharLevelBreakpointsCalculationPart') {
      const rendered = renderByCharLevelBreakpointsSeries(part, options ?? {})
      if (rendered.values.length > 0) {
        baseValues = rendered.values
        baseParts.push(rendered.text)
        numericBaseSeries.push(rendered.values)
      }
      continue
    }
    if (partType === 'ByCharLevelFormulaCalculationPart') {
      const rendered = renderByCharLevelFormulaSeries(part, options ?? {})
      if (rendered.values.length > 0) {
        baseValues = rendered.values
        baseParts.push(rendered.text)
        numericBaseSeries.push(rendered.values)
      }
      continue
    }
    if (partType === 'NumberCalculationPart') {
      const values = evaluateCalculationPartValues(part, dataValues, options ?? {})
      if (values.length > 0) {
        baseValues = values
        baseParts.push(formatCalculationValuesAsText(values, options ?? {}))
        numericBaseSeries.push(values)
      }
      continue
    }
    if (partType === 'EffectValueCalculationPart') {
      const values = evaluateCalculationPartValues(part, dataValues, options ?? {})
      if (values.length > 0) {
        baseValues = values
        baseParts.push(
          formatCalculationValuesAsText(values, options ?? {}) || formatValueSeries(values, ' / ')
        )
        numericBaseSeries.push(values)
      }
      continue
    }
    if (partType === 'StatByNamedDataValueCalculationPart') {
      const dataValueName = String(part.mDataValue ?? '')
      const values = firstValuesFromDataValues(dataValues, dataValueName)
      const lower = dataValueName.toLowerCase()
      if (values && values.length > 0 && (lower.startsWith('astoad') || lower.startsWith('astoap'))) {
        baseValues = values
        baseParts.push(formatValueSeries(values, ' / '))
        numericBaseSeries.push(values)
        continue
      }
      if (
        values &&
        values.length > 0 &&
        (lower.includes('percentmana') ||
          lower.includes('manaincrease') ||
          (lower.includes('percent') && !lower.includes('ad') && !lower.includes('ap')))
      ) {
        baseValues = values
        baseParts.push(formatValueSeries(values, ' / '))
        numericBaseSeries.push(values)
        continue
      }
    }
    const ratio = extractRatioFromCalculationPart(part, dataValues, options)
    if (ratio) {
      ratios.push(ratio)
      continue
    }
    if (
      partType === 'SumOfSubPartsCalculationPart' ||
      partType === 'ProductOfSubPartsCalculationPart' ||
      partType === 'ClampSubPartsCalculationPart'
    ) {
      const values = evaluateCalculationPartValues(part, dataValues, options ?? {})
      if (values.length > 0) {
        baseValues = values
        baseParts.push(formatCalculationValuesAsText(values, options ?? {}) || formatValueSeries(values, ' / '))
        numericBaseSeries.push(values)
      }
      const subparts = Array.isArray(part.mSubparts)
        ? part.mSubparts
        : [part.mPart1, part.mPart2].filter(Boolean)
      const nested = buildBinCalculationExpression(subparts, dataValues, options)
      if (baseValues.length === 0 && nested.baseValues.length > 0) baseValues = nested.baseValues
      if (!baseParts.length && nested.expression) baseParts.push(nested.expression)
      ratios.push(...nested.ratios)
    }
  }

  const ratioText = ratios
    .map((ratio) => formatRatioSuffix(ratio, { html: options?.htmlRatios }))
    .filter(Boolean)
    .join(' ')
  let baseText = baseParts.filter(Boolean).join(' + ')
  if (numericBaseSeries.length > 1) {
    const limit = Math.max(...numericBaseSeries.map((series) => series.length))
    const summed: number[] = []
    for (let i = 0; i < limit; i += 1) {
      let sum = 0
      for (const series of numericBaseSeries) {
        sum += series[Math.min(i, series.length - 1)] ?? 0
      }
      summed.push(sum)
    }
    if (summed.length > 0) {
      baseValues = summed
      baseText = formatCalculationValuesAsText(summed, options ?? {}) || formatValueSeries(summed, ' / ')
    }
  }
  let expression = [baseText, ratioText].filter(Boolean).join(' ')
  if (baseText === '0' && ratioText) expression = ratioText
  return { expression, baseValues, ratios }
}

function calculationUsesPercentDisplay(key: string, calculation: Record<string, unknown>): boolean {
  const normalized = key.toLowerCase()
  if (/passivemanacalctooltip|manacalctooltip/.test(normalized)) {
    return Boolean(calculation.mDisplayAsPercent)
  }
  if (Boolean(calculation.mDisplayAsPercent)) return true
  return /attackspeed|attack speed|msbuff|movementspeed|percentms|slowpercent|percenthp|percentmax|percent/.test(
    normalized
  )
}

function extractBinCalculations(
  binSpell: Record<string, unknown>,
  dataValues: Array<{ name: string; values: number[] }>,
  context?: { maxRank?: number; slotIndex?: number; isPassive?: boolean; ddSpell?: ChampionSpell }
): Array<{
  key: string
  expression: string
  expressionHtml: string
  baseValues: number[]
  ratios: Array<{ stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' }>
}> {
  const out: Array<{
    key: string
    expression: string
    expressionHtml: string
    baseValues: number[]
    ratios: Array<{ stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' }>
  }> = []
  const calculations = asObject(binSpell.mSpellCalculations)
  const spellBin = asObject(binSpell.mSpell ?? binSpell)
  const builtByKey = new Map<
    string,
    {
      expression: string
      expressionHtml: string
      baseValues: number[]
      ratios: Array<{ stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' }>
    }
  >()

  for (const [key, rawCalculation] of Object.entries(calculations)) {
    const calculation = asObject(rawCalculation)
    const calculationType = String(calculation.__type ?? '')
    if (calculationType === 'GameCalculationModified') continue
    if (calculationType === 'GameCalculationConditional') {
      const namedRef = String(
        calculation.mConditionalGameCalculation ?? calculation.mDefaultGameCalculation ?? ''
      )
      if (namedRef) {
        const ref = findCalculationByKey(calculations, namedRef)
        if (ref) {
          const refParts = Array.isArray(ref.mFormulaParts) ? ref.mFormulaParts : []
          const buildOptions: BinCalculationBuildOptions = {
            maxRank: context?.maxRank,
            slotIndex: context?.slotIndex,
            isPassive: context?.isPassive,
            displayAsPercent: calculationUsesPercentDisplay(key, calculation) ||
              calculationUsesPercentDisplay(key, ref),
            precision: Number(calculation.mPrecision ?? ref.mPrecision ?? 2),
            binSpell: spellBin,
            ddSpell: context?.ddSpell,
          }
          const built = buildBinCalculationExpression(refParts, dataValues, buildOptions)
          const builtHtml = buildBinCalculationExpression(refParts, dataValues, {
            ...buildOptions,
            htmlRatios: true,
          })
          builtByKey.set(key.toLowerCase(), {
            expression: built.expression || formatValueSeries(built.baseValues, ' / '),
            expressionHtml: builtHtml.expression || formatValueSeries(built.baseValues, ' / '),
            baseValues: built.baseValues,
            ratios: built.ratios,
          })
        }
      }
      continue
    }
    const parts = Array.isArray(calculation.mFormulaParts) ? calculation.mFormulaParts : []
    const buildOptions: BinCalculationBuildOptions = {
      maxRank: context?.maxRank,
      slotIndex: context?.slotIndex,
      isPassive: context?.isPassive,
      displayAsPercent: calculationUsesPercentDisplay(key, calculation),
      precision: Number(calculation.mPrecision ?? 2),
      binSpell: spellBin,
      ddSpell: context?.ddSpell,
    }
    const built = buildBinCalculationExpression(parts, dataValues, buildOptions)
    const builtHtml = buildBinCalculationExpression(parts, dataValues, {
      ...buildOptions,
      htmlRatios: true,
    })
    const expression =
      built.expression ||
      (built.baseValues.length > 0 ? formatValueSeries(built.baseValues, ' / ') : '')
    const expressionHtml =
      builtHtml.expression ||
      (built.baseValues.length > 0 ? formatValueSeries(built.baseValues, ' / ') : '')
    builtByKey.set(key.toLowerCase(), {
      expression,
      expressionHtml,
      baseValues: built.baseValues,
      ratios: built.ratios,
    })
  }

  for (const [key, rawCalculation] of Object.entries(calculations)) {
    const calculation = asObject(rawCalculation)
    const calculationType = String(calculation.__type ?? '')
    if (calculationType === 'GameCalculation') {
      const multiplierPart = asObject(calculation.mMultiplier)
      if (Object.keys(multiplierPart).length === 0) continue
      const buildOptions: BinCalculationBuildOptions = {
        maxRank: context?.maxRank,
        slotIndex: context?.slotIndex,
        isPassive: context?.isPassive,
        displayAsPercent: calculationUsesPercentDisplay(key, calculation),
        precision: Number(calculation.mPrecision ?? 2),
        binSpell: spellBin,
        ddSpell: context?.ddSpell,
      }
      const existing = builtByKey.get(key.toLowerCase())
      if (!existing) continue
      const multiplier = evaluateCalculationPartValues(multiplierPart, dataValues, buildOptions)
      const multSeries = multiplier.length > 0 ? multiplier : [1]
      const scaledValues = scaleCalculationValues(
        existing.baseValues.length > 0 ? existing.baseValues : [10],
        multSeries,
        buildOptions.precision ?? 2
      )
      const expression = formatCalculationValuesAsText(scaledValues, buildOptions) || existing.expression
      builtByKey.set(key.toLowerCase(), {
        expression,
        expressionHtml: expression,
        baseValues: scaledValues.length > 0 ? scaledValues : existing.baseValues,
        ratios: [],
      })
      continue
    }
    if (calculationType !== 'GameCalculationModified') continue
    const refKey = String(calculation.mModifiedGameCalculation ?? '').toLowerCase()
    const ref = builtByKey.get(refKey)
    if (!ref) continue
    const buildOptions: BinCalculationBuildOptions = {
      maxRank: context?.maxRank,
      slotIndex: context?.slotIndex,
      isPassive: context?.isPassive,
      displayAsPercent: calculationUsesPercentDisplay(key, calculation),
      precision: Number(calculation.mPrecision ?? 2),
      binSpell: spellBin,
      ddSpell: context?.ddSpell,
    }
    const multiplier = evaluateCalculationPartValues(
      asObject(calculation.mMultiplier),
      dataValues,
      buildOptions
    )
    const multSeries = multiplier.length > 0 ? multiplier : [1]
    const scaledValues = scaleCalculationValues(ref.baseValues, multSeries, buildOptions.precision ?? 2)
    const expression = formatCalculationValuesAsText(scaledValues, buildOptions) || ref.expression
    const expressionHtml = expression
    builtByKey.set(key.toLowerCase(), {
      expression,
      expressionHtml,
      baseValues: scaledValues.length > 0 ? scaledValues : ref.baseValues,
      ratios: ref.ratios,
    })
  }

  for (const [key, built] of builtByKey.entries()) {
    out.push({ key, ...built })
  }
  return out
}

function normalizeLookupToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findBinSpellForDDragon(
  championBin: ChampionBinJson | null,
  lookupTokens: string[]
): Record<string, unknown> | null {
  if (!championBin) return null
  const tokens = lookupTokens
    .map((token) => String(token || '').trim())
    .filter(Boolean)
    .map((token) => normalizeLookupToken(token))
    .filter(Boolean)
  if (tokens.length === 0) return null

  let bestSpell: Record<string, unknown> | null = null
  let bestScore = -1
  for (const [key, value] of Object.entries(championBin)) {
    if (!value || typeof value !== 'object') continue
    const scriptName = normalizeLookupToken(String(value.mScriptName ?? ''))
    const pathEnd = key.replace(/\\/g, '/').toLowerCase()
    const matchedToken = tokens.find((target) => {
      if (scriptName === target) return true
      return pathEnd.endsWith(`/${target}`)
    })
    if (!matchedToken) continue
    const spell = asObject(value.mSpell)
    if (Object.keys(spell).length === 0) continue
    let score = 0
    if (scriptName === matchedToken) score += 8
    if (pathEnd.endsWith(`/${matchedToken}`)) score += 4
    if (Object.keys(asObject(spell.mSpellCalculations)).length > 0) score += 5
    if (Array.isArray(spell.DataValues) && spell.DataValues.length > 0) score += 3
    if (score > bestScore) {
      bestScore = score
      bestSpell = spell
    }
  }
  return bestSpell
}

function mapCDragonCoefficientKey(key: string): { stat: string; type: 'physical' | 'magic' | 'true' } {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (normalized === 'coefficient1' || normalized.endsWith('coefficient1')) {
    return { stat: 'totalAD', type: 'physical' }
  }
  if (normalized.includes('attack') || normalized.includes('ad')) {
    return { stat: 'totalAD', type: 'physical' }
  }
  return { stat: mapRatioStat(key), type: 'magic' }
}

function extractSpellRatios(
  ddSpell: ChampionSpell,
  cdSpell: CDragonChampionSpell,
  binSpell?: Record<string, unknown> | null
): Array<{ stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' }> {
  const maxRank = Number(ddSpell.maxrank ?? cdSpell.maxLevel ?? 0)
  const ratios: Array<{ stat: string; coefficient: number[]; type: 'physical' | 'magic' | 'true' }> = []
  const binDataValues = extractBinDataValues(binSpell ?? {}, maxRank)
  const binCalculations = extractBinCalculations(binSpell ?? {}, binDataValues, {
    maxRank,
    slotIndex: inferSpellSlotIndex(ddSpell),
  })
  const fromBin = binCalculations.flatMap((calc) => calc.ratios)
  if (fromBin.length > 0) return fromBin

  const ddVars = Array.isArray(ddSpell.vars) ? (ddSpell.vars as Array<Record<string, unknown>>) : []
  ddVars.forEach((entry) => {
    const coeff = trimByMaxRank(parseNumberArray(entry.coeffs), maxRank)
    if (coeff.length === 0) return
    const link = String(entry.link ?? '')
    const stat = mapRatioStat(link)
    const lower = link.toLowerCase()
    const type: 'physical' | 'magic' | 'true' = lower.includes('attack') ? 'physical' : 'magic'
    ratios.push({ stat, coefficient: coeff, type })
  })

  const cdCoefficients = asObject(cdSpell.coefficients)
  for (const [key, value] of Object.entries(cdCoefficients)) {
    const coeff = trimByMaxRank(typeof value === 'number' ? [value] : parseNumberArray(value), maxRank)
    if (coeff.length === 0 || coeff.every((c) => c === 0)) continue
    const mapped = mapCDragonCoefficientKey(key)
    ratios.push({ stat: mapped.stat, coefficient: coeff, type: mapped.type })
  }
  for (const dataValue of binDataValues) {
    const lower = dataValue.name.toLowerCase()
    if (!lower.includes('ratio')) continue
    const stat = mapRatioStat(lower)
    const type: 'physical' | 'magic' | 'true' = lower.includes('ad') ? 'physical' : 'magic'
    ratios.push({ stat, coefficient: dataValue.values, type })
  }
  return ratios
}

function extractSpellEffects(
  ddSpell: ChampionSpell,
  cdSpell: CDragonChampionSpell,
  binSpell?: Record<string, unknown> | null
): Array<{ key: string; values: number[] }> {
  const maxRank = Number(ddSpell.maxrank ?? cdSpell.maxLevel ?? 0)
  const out = new Map<string, number[]>()
  const ddEffect = ddSpell.effect
  if (Array.isArray(ddEffect)) {
    ddEffect.forEach((entry, idx) => {
      const values = trimByMaxRank(parseNumberArray(entry), maxRank)
      if (idx <= 0 || values.length === 0) return
      out.set(`e${idx}`, values)
    })
  }

  const effectAmounts = asObject(cdSpell.effectAmounts)
  for (const [key, valuesRaw] of Object.entries(effectAmounts)) {
    const values = trimByMaxRank(parseNumberArray(valuesRaw), maxRank)
    if (values.length === 0) continue
    out.set(key.toLowerCase(), values)
  }
  const binDataValues = extractBinDataValues(binSpell ?? {}, maxRank)
  for (const value of binDataValues) {
    if (!out.has(value.name.toLowerCase())) {
      out.set(value.name.toLowerCase(), value.values)
    }
  }
  return Array.from(out.entries()).map(([key, values]) => ({ key, values }))
}

function buildSpellVariableMap(
  ddSpell: ChampionSpell,
  cdSpell: CDragonChampionSpell,
  binSpell?: Record<string, unknown> | null,
  sharedVars?: Map<string, string>,
  options?: { isPassive?: boolean }
): Map<string, string> {
  const maxRank = options?.isPassive
    ? PASSIVE_CHAMPION_LEVELS.length
    : Number(ddSpell.maxrank ?? cdSpell.maxLevel ?? DEFAULT_ABILITY_MAX_RANK) || DEFAULT_ABILITY_MAX_RANK
  const map = new Map<string, string>()
  const setVar = (key: string, value: string): void => {
    const normalized = key.toLowerCase()
    map.set(normalized, value)
    const compact = normalized.replace(/[^a-z0-9]/g, '')
    if (compact) map.set(compact, value)
  }
  extractSpellEffects(ddSpell, cdSpell, binSpell).forEach((effect) => {
    setVar(effect.key, formatValueSeries(effect.values))
  })
  if (Array.isArray(ddSpell.effect)) {
    ddSpell.effect.forEach((entry, idx) => {
      if (idx <= 0) return
      const values = trimByMaxRank(parseNumberArray(entry), maxRank)
      if (values.length === 0) return
      setVar(`effect${idx}amount`, formatValueSeries(values))
    })
  }
  const binDataValues = extractBinDataValues(binSpell ?? {}, maxRank)
  binDataValues.forEach((entry) => {
    setVar(entry.name, formatValueSeries(entry.values))
  })
  if (options?.isPassive) {
    const id = String(ddSpell.id ?? '').toLowerCase()
    // Riot sometimes ships passive templates with legacy @fXX@ placeholders.
    // Provide known aliases from bin data values when available.
    if (id.includes('xayahpassive')) {
      const fAliases: Array<[string, string]> = [
        ['f12', 'PFeatherDuration'],
        ['f14', 'PStacksPerCast'],
        ['f16', 'PDamageFalloffMax'],
      ]
      fAliases.forEach(([alias, dataKey]) => {
        const found = binDataValues.find((entry) => entry.name.toLowerCase() === dataKey.toLowerCase())
        if (found && found.values.length > 0) {
          setVar(alias, formatValueSeries(found.values))
        }
      })
    }
  }
  const calculations = extractBinCalculations(binSpell ?? {}, binDataValues, {
    maxRank,
    slotIndex: inferSpellSlotIndex(ddSpell),
    isPassive: options?.isPassive,
    ddSpell,
  })
  calculations.forEach((calculation) => {
    const calcKeyLower = calculation.key.toLowerCase()
    if (calcKeyLower === 'currentcritdamage') {
      const mod = binDataValues.find((v) => v.name.toLowerCase() === 'critdamagemod')
      if (mod && mod.values.length > 0) {
        const pct = formatValueSeries(mod.values.map((v) => Math.round(v * 100)))
        setVar(calculation.key, `${pct}%`)
        return
      }
    }
    if (calcKeyLower.includes('passivemanacalctooltip') || calcKeyLower.includes('manacalctooltip')) {
      if (calculation.baseValues.length > 0) {
        const percentSeries = calculation.baseValues.map((value) => {
          const normalized = value > 0 && value <= 1 ? value * 100 : value
          return Number(normalized.toFixed(2))
        })
        setVar(calculation.key, formatValueSeries(percentSeries))
        return
      }
    }
    let rendered =
      calculation.expressionHtml ||
      calculation.expression ||
      (calculation.baseValues.length > 0 ? formatValueSeries(calculation.baseValues, ' / ') : '')
    if (
      options?.isPassive &&
      calculation.baseValues.length > 0 &&
      calculation.ratios.some((ratio) => ratio.coefficient.some((coeff) => Math.abs(coeff) >= 5))
    ) {
      rendered = formatValueSeries(calculation.baseValues, ' / ')
    }
    if (!rendered && calculation.ratios.length > 0) {
      rendered = calculation.ratios
        .map((ratio) => formatRatioSuffix(ratio, { html: Boolean(calculation.expressionHtml) }))
        .filter(Boolean)
        .join(' ')
    }
    if (rendered) {
      setVar(calculation.key, rendered)
    }
  })
  const cooldown = trimByMaxRank(parseNumberArray(ddSpell.cooldown), maxRank)
  if (cooldown.length > 0) setVar('cooldown', formatValueSeries(cooldown))
  const cost = trimByMaxRank(parseNumberArray(ddSpell.cost), maxRank)
  if (cost.length > 0) setVar('cost', formatValueSeries(cost))
  const range = trimByMaxRank(parseNumberArray(ddSpell.range), maxRank)
  if (range.length > 0) setVar('range', formatValueSeries(range))

  // Add scalar and array numeric values from CDragon spell for tooltip variables
  // like slowduration, stunduration, etc.
  for (const [key, raw] of Object.entries(cdSpell)) {
    const normalizedKey = key.toLowerCase()
    if (!normalizedKey) continue
    if (map.has(normalizedKey)) continue
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      setVar(normalizedKey, formatResolvedNumber(raw))
      continue
    }
    const arr = trimByMaxRank(parseNumberArray(raw), maxRank)
    if (arr.length > 0) {
      setVar(normalizedKey, formatValueSeries(arr))
    }
  }

  for (const [key, raw] of Object.entries(ddSpell)) {
    const normalizedKey = key.toLowerCase()
    if (!normalizedKey || map.has(normalizedKey)) continue
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      setVar(normalizedKey, formatResolvedNumber(raw))
      continue
    }
    const arr = trimByMaxRank(parseNumberArray(raw), maxRank)
    if (arr.length > 0) {
      setVar(normalizedKey, formatValueSeries(arr))
    }
  }

  if (sharedVars) {
    for (const [key, value] of sharedVars.entries()) {
      const normalized = key.toLowerCase()
      if (!map.has(normalized)) {
        map.set(normalized, value)
      }
      const compact = normalized.replace(/[^a-z0-9]/g, '')
      if (compact && !map.has(compact)) {
        map.set(compact, value)
      }
    }
  }

  return map
}

/** Riot client tokens: %i:scaleArmor%{{ f1 }} — icon + dynamic armor value (f1/f2 not in bin). */
function normalizeRiotInlineIconTokens(raw: string): string {
  let text = raw
  // Armor % is already in the sentence; drop redundant (icon + unresolved f1/f2).
  text = text.replace(/\s*\(%i:scalearmor%\{\{\s*f1\s*\}\}\)/gi, '')
  text = text.replace(/\s*\(%i:scalearmor%\{\{\s*f2\s*\}\}\)/gi, '')
  // e.g. %i:OnHit% <OnHit>…</OnHit> — drop token when the semantic tag follows.
  text = text.replace(/%i:([a-zA-Z][a-zA-Z0-9]*)%\s*(<\s*\1\b)/gi, '$1')
  text = text.replace(/%i:([a-zA-Z][a-zA-Z0-9]*)%/gi, (_match, tag: string) => {
    const meta = TOOLTIP_TAG_MAP[tag.toLowerCase()]
    if (!meta?.icon) return ''
    return `<span class="tooltip-icon tooltip-icon-${meta.icon}" aria-hidden="true"></span>`
  })
  return text
}

function wrapTrueDamageHtml(inner: string): string {
  const trimmed = inner.trim()
  if (!trimmed) return ''
  return `<span class="dmg-true"><span class="tooltip-icon tooltip-icon-true" aria-hidden="true"></span> ${trimmed}</span>`
}

function firstScalarFromDataValues(
  dataValues: Array<{ name: string; values: number[] }>,
  name: string
): number | null {
  const entry = dataValues.find((v) => v.name.toLowerCase() === name.toLowerCase())
  if (!entry || entry.values.length === 0) return null
  const value = Number(entry.values[0])
  return Number.isFinite(value) ? value : null
}

type StringTableEntries = Record<string, string>

function extractPassiveTooltipLocKeys(
  binSpell: Record<string, unknown> | null | undefined
): { tooltipKey?: string; extendedKey?: string; summaryKey?: string } {
  if (!binSpell) return {}
  const client = asObject(binSpell.mClientData)
  const tooltipData = asObject(client.mTooltipData)
  const locKeys = asObject(tooltipData.mLocKeys)
  return {
    tooltipKey: String(locKeys.keyTooltip ?? '').trim() || undefined,
    extendedKey:
      String(locKeys.keyTooltipExtendedBelowLine ?? locKeys.keyTooltipExtended ?? '').trim() ||
      undefined,
    summaryKey: String(locKeys.keySummary ?? locKeys.keyTooltipSimple ?? '').trim() || undefined,
  }
}

function lookupStringTableEntry(entries: StringTableEntries, key: string): string {
  const normalized = String(key ?? '').trim().toLowerCase()
  if (!normalized) return ''
  return String(entries[normalized] ?? '').trim()
}

function spellRefToStringTableKeys(ref: string, gameMode = 1): string[] {
  const trimmed = String(ref ?? '').trim()
  if (!trimmed) return []
  const withGamemode = trimmed.replace(/@gamemodeinteger@/gi, String(gameMode))
  const match = withGamemode.match(/^spell_([a-z0-9_]+)_tooltip(?:_(\d+))?$/i)
  if (!match) return []
  const scriptPart = String(match[1] ?? '').toLowerCase()
  const modeSuffix = match[2] ? String(match[2]) : String(gameMode)
  return [
    `spell_${scriptPart}_tooltip_${modeSuffix}`,
    `spell_${scriptPart}_tooltip_${gameMode}`,
    `spell_${scriptPart}_tooltip`,
  ]
}

function resolveStringTableMustacheRefs(
  raw: string,
  entries: StringTableEntries,
  gameMode = 1,
  depth = 0
): string {
  if (!raw || depth > 6) return raw
  let out = String(raw)
  out = out.replace(/@gamemodeinteger@/gi, String(gameMode))
  out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expression: string) => {
    const expr = String(expression).trim()
    if (!expr) return _match
    const spellKeys = spellRefToStringTableKeys(expr, gameMode)
    for (const key of spellKeys) {
      const resolved = lookupStringTableEntry(entries, key)
      if (resolved) {
        return resolveStringTableMustacheRefs(resolved, entries, gameMode, depth + 1)
      }
    }
    const direct = lookupStringTableEntry(entries, expr)
    if (direct) {
      return resolveStringTableMustacheRefs(direct, entries, gameMode, depth + 1)
    }
    return _match
  })
  if (out !== raw && depth < 6) {
    return resolveStringTableMustacheRefs(out, entries, gameMode, depth + 1)
  }
  return out
}

function extractClientTooltipMarkup(raw: string): string {
  let text = sanitizeRiotTooltipMarkup(String(raw ?? '').trim())
  if (!text) return ''
  const mainMatch = text.match(/<mainText>([\s\S]*?)<\/mainText>/i)
  if (mainMatch) text = mainMatch[1].trim()
  text = text.replace(/<rules>([\s\S]*?)<\/rules>/gi, '<span class="tooltip-rules">$1</span>')
  text = text
    .replace(/<\/?titleLeft[^>]*>/gi, '')
    .replace(/<\/?titleRight[^>]*>/gi, '')
    .replace(/<\/?subtitleLeft[^>]*>/gi, '')
    .replace(/<\/?subtitleRight[^>]*>/gi, '')
    .replace(/<\/?postScriptLeft[^>]*>/gi, '')
    .replace(/<\/?postScriptRight[^>]*>/gi, '')
    .replace(/<infoArea>[\s\S]*?<\/infoArea>/gi, '')
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br><br>')
  return text.trim()
}

function buildChampionPassivePrefixes(championId: string): string[] {
  const id = normalizeChampionBinId(championId)
  return [...new Set([id, `${id}p`, `${id}passive`, `${id}passivebuff`])]
}

function derivePassiveScriptTokensFromLocKeys(locKeys: ReturnType<typeof extractPassiveTooltipLocKeys>): string[] {
  const out = new Set<string>()
  const candidates = [locKeys.tooltipKey, locKeys.extendedKey, locKeys.summaryKey]
  for (const raw of candidates) {
    const key = String(raw ?? '').trim().toLowerCase()
    if (!key) continue
    const stripped = key
      .replace(/^spell_/, '')
      .replace(/^generatedtip_passive_/, '')
      .replace(/^game_character_passivetooltip_/, '')
      .replace(/_(tooltipwithextendedbehaviorhint|tooltipextended|tooltip|summary|description)$/g, '')
      .replace(/_+\d+$/g, '')
      .trim()
    if (stripped) out.add(stripped)
  }
  return [...out]
}

function expandPassiveScriptTokenVariants(token: string, championId: string): string[] {
  const out = new Set<string>()
  const normalizedToken = String(token ?? '').trim().toLowerCase()
  if (!normalizedToken) return []
  out.add(normalizedToken)
  const id = normalizeChampionBinId(championId)
  if (id) {
    if (normalizedToken.startsWith(id) && normalizedToken.length > id.length) {
      const rest = normalizedToken.slice(id.length).replace(/^_+/, '')
      if (rest) {
        out.add(`${id}_${rest}`)
        out.add(`${id}${rest}`)
      }
    } else {
      out.add(`${id}_${normalizedToken}`)
      out.add(`${id}${normalizedToken}`)
    }
  }
  return [...out]
}

/** Client tooltips use @PassiveHealAmount@ or @HealthPercentPer5*100@; parser expects {{ … }}. */
function normalizeAtVariablesToMustache(raw: string): string {
  return raw.replace(/@([a-zA-Z0-9_.:]+(?:\*[.\d-]+)?)@/gi, '{{ $1 }}')
}

function sanitizeRiotTooltipMarkup(raw: string): string {
  let text = String(raw ?? '')
  text = text.replace(/<font\b[^>]*>/gi, '')
  text = text.replace(/<\/font>/gi, '')
  text = text.replace(/<color\b[^>]*>/gi, '')
  text = text.replace(/<\/color>/gi, '')
  return text
}

function cleanupTooltipArtifacts(html: string): string {
  let out = String(html ?? '')
  out = out.replace(/\(\s*\+\s*-\s*\)/g, '')
  out = out.replace(/\(\s*\+-\s*\)/g, '')
  out = out.replace(/\(\s*-\s*\)/g, '')
  out = out.replace(
    /<span class="tooltip-tag[^"]*">\s*\+\s*<span class="tooltip-tag[^"]*">\(\s*-\s*\)<\/span>\s*<\/span>/g,
    ''
  )
  out = out.replace(/<span class="[^"]*">\s*-\s*<\/span>/g, '')
  out = out.replace(/\}\}(?=\s*(?:<|$))/g, '')
  out = out.replace(/\s{2,}/g, ' ')
  return out.trim()
}

function stripInlineHtmlTags(html: string): string {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPassiveStringTableLookupKeys(
  championId: string,
  binSpell: Record<string, unknown> | null | undefined,
  locKeys: ReturnType<typeof extractPassiveTooltipLocKeys>,
  gameMode = 1
): string[] {
  const id = normalizeChampionBinId(championId)
  const scriptName = String(binSpell?.mScriptName ?? '').trim().toLowerCase()
  const prefixes = buildChampionPassivePrefixes(championId)
  const keys: string[] = [
    locKeys.tooltipKey ?? '',
    scriptName ? `spell_${scriptName}_tooltip_${gameMode}` : '',
    scriptName ? `spell_${scriptName}_tooltip` : '',
    scriptName ? `generatedtip_passive_${scriptName}_tooltip` : '',
    locKeys.extendedKey ?? '',
    scriptName ? `spell_${scriptName}_tooltipextended` : '',
    scriptName ? `generatedtip_passive_${scriptName}_tooltipextended` : '',
  ]
  for (const prefix of prefixes) {
    keys.push(
      `spell_${prefix}_tooltip_${gameMode}`,
      `spell_${prefix}_tooltip`,
      `generatedtip_passive_${prefix}_tooltip`,
      `spell_${prefix}passivebuff_tooltip_${gameMode}`,
      `spell_${prefix}passivebuff_tooltip`,
      `generatedtip_passive_${prefix}passivebuff_tooltip`,
      `spell_${prefix}passive_tooltip_${gameMode}`,
      `spell_${prefix}passive_tooltip`,
      `spell_${prefix}_tooltipextended`,
      `spell_${prefix}passivebuff_tooltipextended`,
      `generatedtip_passive_${prefix}_tooltipextended`
    )
  }
  keys.push(
    `spell_${id}passive_tooltip_${gameMode}`,
    `spell_${id}passive_tooltip`,
    `spell_${id}passive_tooltipextended`,
    locKeys.summaryKey ?? '',
    `spell_${id}passive_summary`,
    scriptName ? `generatedtip_passive_${scriptName}_description` : '',
    `game_character_passivetooltip_${id}`,
    `game_character_passivedescription_${id}`
  )

  // Many passives live under generatedtip_passive_{ruby_}{scriptToken}_tooltip.
  const scriptTokens = derivePassiveScriptTokensFromLocKeys(locKeys)
  scriptTokens.forEach((token) => {
    const variants = expandPassiveScriptTokenVariants(token, championId)
    variants.forEach((variant) => {
      keys.push(
        `generatedtip_passive_${variant}_tooltip`,
        `generatedtip_passive_${variant}_tooltipextended`,
        `generatedtip_passive_${variant}_tooltipwithextendedbehaviorhint`,
        `generatedtip_passive_ruby_${variant}_tooltip`,
        `generatedtip_passive_ruby_${variant}_tooltipextended`,
        `generatedtip_passive_ruby_${variant}_tooltipwithextendedbehaviorhint`
      )
    })
  })

  const normalized = keys
    .filter((key): key is string => Boolean(key))
    .map((key) => key.toLowerCase())
  return [...new Set(normalized)]
}

function isDetailedPassiveTooltipKey(key: string): boolean {
  const normalized = key.toLowerCase()
  if (normalized.endsWith('_summary') || normalized.endsWith('_description')) return false
  if (normalized.includes('simple')) return false
  return (
    normalized.endsWith('_tooltip') ||
    normalized.includes('_tooltip') ||
    normalized.includes('tooltipextended')
  )
}

function normalizePassiveStringTableSection(
  section: string,
  stringTable: StringTableEntries,
  gameMode: number
): string {
  const resolved = resolveStringTableMustacheRefs(String(section ?? ''), stringTable, gameMode)
  const extracted = extractClientTooltipMarkup(resolved)
  let out = extracted || resolved
  out = out.replace(/@?spellmodifierdescriptionappend@?/gi, '')
  return normalizeAtVariablesToMustache(out)
}

function scorePassiveTooltipCandidate(text: string): number {
  const trimmed = String(text ?? '').trim()
  if (!trimmed || isBrokenTooltipText(trimmed) || isMetaDdragonTooltip(trimmed)) return -1
  let score = trimmed.length
  if (trimmed.includes('{{') || trimmed.includes('@')) score -= 80
  if (/<titleLeft>/i.test(trimmed)) score -= 40
  if (trimmed.includes('tooltip-rules')) score += 20
  return score
}

function pickBestPassiveTooltipFromKeys(
  lookupKeys: string[],
  stringTable: StringTableEntries,
  gameMode: number,
  options?: { extended?: boolean }
): string {
  let best = ''
  let bestScore = -1
  for (const key of lookupKeys) {
    const isExtended = key.includes('extended') || key.includes('tooltipextended')
    if (options?.extended && !isExtended) continue
    if (!options?.extended && isExtended) continue
    if (!options?.extended && !isDetailedPassiveTooltipKey(key)) continue
    if (options?.extended && key.endsWith('_summary')) continue
    const raw = lookupStringTableEntry(stringTable, key)
    if (!raw) continue
    const normalized = normalizePassiveStringTableSection(raw, stringTable, gameMode)
    const score = scorePassiveTooltipCandidate(normalized)
    if (score > bestScore) {
      bestScore = score
      best = normalized
    }
  }
  return best
}

function extractSupplementalPassiveSection(main: string, extended: string): string {
  const mainPlain = normalizeTooltipPlainText(main).replace(/\s+/g, ' ').trim()
  const extPlain = normalizeTooltipPlainText(extended).replace(/\s+/g, ' ').trim()
  if (!extPlain) return ''
  if (mainPlain && extPlain === mainPlain) return ''
  if (mainPlain && extPlain.startsWith(mainPlain)) {
    const rulesOnly = extended.match(/<span class="tooltip-rules">[\s\S]*<\/span>/i)
    if (rulesOnly?.[0]) return rulesOnly[0]
    const remainder = extended.slice(extended.toLowerCase().indexOf('<br'))
    return remainder.trim()
  }
  const rulesOnly = extended.match(/<span class="tooltip-rules">[\s\S]*<\/span>/i)
  if (rulesOnly?.[0] && !mainPlain.includes(normalizeTooltipPlainText(rulesOnly[0]).slice(0, 40))) {
    return rulesOnly[0]
  }
  if (mainPlain && extPlain.includes(mainPlain.slice(0, Math.min(60, mainPlain.length)))) {
    const rulesOnlyMatch = extended.match(/<span class="tooltip-rules">[\s\S]*<\/span>/i)
    return rulesOnlyMatch?.[0] ?? ''
  }
  return extended
}

function resolvePassiveTooltipContent(args: {
  championId: string
  passiveBinSpell: Record<string, unknown> | null
  stringTable: StringTableEntries
}): { main: string; extended: string[] } {
  const { championId, passiveBinSpell, stringTable } = args
  const locKeys = extractPassiveTooltipLocKeys(passiveBinSpell)
  const gameMode = resolveGameModeInteger(passiveBinSpell)
  const lookupKeys = buildPassiveStringTableLookupKeys(championId, passiveBinSpell, locKeys, gameMode)
  let main = pickBestPassiveTooltipFromKeys(lookupKeys, stringTable, gameMode)

  const extendedKeys = lookupKeys.filter((key) => key.includes('extended') || key.includes('tooltipextended'))
  const discoveredKeys: string[] = []
  if (!main) {
    const id = normalizeChampionBinId(championId)
    if (id) {
      for (const key of Object.keys(stringTable)) {
        const normalized = key.toLowerCase()
        if (!normalized.startsWith('generatedtip_passive_')) continue
        if (!normalized.includes(id)) continue
        if (!normalized.includes('tooltip')) continue
        if (normalized.includes('tooltipsimple')) continue
        if (normalized.includes('tft_')) continue
        discoveredKeys.push(normalized)
      }
      const fallbackMain = pickBestPassiveTooltipFromKeys(discoveredKeys, stringTable, gameMode)
      if (fallbackMain) {
        main = fallbackMain
      }
    }
  }

  const allExtendedKeys = [
    ...extendedKeys,
    ...discoveredKeys.filter((key) => key.includes('extended') || key.includes('tooltipextended')),
  ]
  const extended: string[] = []
  for (const key of allExtendedKeys) {
    const raw = lookupStringTableEntry(stringTable, key)
    if (!raw) continue
    const normalized = normalizePassiveStringTableSection(raw, stringTable, gameMode)
    if (!normalized || isMetaDdragonTooltip(normalized) || isBrokenTooltipText(normalized)) continue
    const supplemental = main ? extractSupplementalPassiveSection(main, normalized) : normalized
    if (!supplemental || extended.includes(supplemental)) continue
    extended.push(supplemental)
  }

  return { main, extended }
}

function isBrokenTooltipText(text: string): boolean {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return true
  if (trimmed === '-}}' || trimmed === '-' || trimmed === '}}' || trimmed === '{{') return true
  if (/^[-{}]+$/.test(trimmed)) return true
  return false
}

function isMetaDdragonTooltip(raw: string): boolean {
  const text = String(raw ?? '').trim()
  if (!text) return false
  if (/spell_[a-z0-9]+_tooltip/i.test(text)) return true
  if (/\{\{\s*spell_[a-z0-9_]+_tooltip/i.test(text)) return true
  if (/@gamemodeinteger@/i.test(text)) return true
  if (/spellmodifierdescriptionappend/i.test(text)) return true
  if (/\{\{[^{}]*\{\{/.test(text)) return true
  return false
}

function resolveGameModeInteger(binSpell?: Record<string, unknown> | null): number {
  if (!binSpell) return 1
  const dataValues = extractBinDataValues(binSpell, DEFAULT_ABILITY_MAX_RANK)
  const entry = dataValues.find((v) => v.name.toLowerCase() === 'gamemodeinteger')
  const value = entry?.values?.[0]
  if (value != null && Number.isFinite(value)) {
    const mode = Math.round(value)
    return mode > 0 ? mode : 1
  }
  return 1
}

function buildSpellStringTableLookupKeys(
  ddSpell: ChampionSpell,
  binSpell: Record<string, unknown> | null | undefined,
  gameMode: number
): string[] {
  const spellId = String(ddSpell.id ?? '').trim().toLowerCase()
  const scriptName = String(binSpell?.mScriptName ?? '').trim().toLowerCase()
  const locKeys = extractPassiveTooltipLocKeys(binSpell)
  const keys = [
    locKeys.tooltipKey,
    `spell_${spellId}_tooltip_${gameMode}`,
    scriptName ? `spell_${scriptName}_tooltip_${gameMode}` : '',
    `spell_${spellId}_tooltip`,
    scriptName ? `spell_${scriptName}_tooltip` : '',
    locKeys.extendedKey,
    scriptName ? `spell_${scriptName}_tooltipextended` : '',
    `spell_${spellId}_tooltipextended`,
    locKeys.summaryKey,
    `spell_${spellId}_summary`,
    scriptName ? `generatedtip_spell_${scriptName}_description` : '',
  ]
  return [...new Set(keys.filter((k): k is string => Boolean(k)).map((key) => key.toLowerCase()))]
}

function isUsableSpellTooltipKey(key: string): boolean {
  const normalized = key.toLowerCase()
  if (
    normalized.includes('tooltiplevelup') ||
    normalized.includes('displayname') ||
    normalized.includes('pickchoice')
  ) {
    return false
  }
  if (normalized.endsWith('_summary') && !normalized.includes('tooltip')) return false
  return normalized.includes('tooltip')
}

function normalizeStringTableTooltipSection(
  section: string,
  stringTable: StringTableEntries,
  gameMode = 1
): string {
  const resolved = resolveStringTableMustacheRefs(
    sanitizeRiotTooltipMarkup(String(section ?? '')),
    stringTable,
    gameMode
  )
  const extracted = extractClientTooltipMarkup(resolved)
  let out = extracted || resolved
  out = out.replace(/@?spellmodifierdescriptionappend@?/gi, '')
  return normalizeAtVariablesToMustache(out)
}

function isDuplicateTooltipSection(mainHtml: string, sectionHtml: string): boolean {
  const mainPlain = normalizeTooltipPlainText(mainHtml).replace(/\s+/g, ' ').trim()
  const sectionPlain = normalizeTooltipPlainText(sectionHtml).replace(/\s+/g, ' ').trim()
  if (!sectionPlain) return true
  if (!mainPlain) return false
  if (sectionPlain === mainPlain) return true
  if (sectionPlain.length > 40 && mainPlain.includes(sectionPlain.slice(0, Math.min(100, sectionPlain.length)))) {
    return true
  }
  if (mainPlain.length > 40 && sectionPlain.includes(mainPlain.slice(0, Math.min(100, mainPlain.length)))) {
    return true
  }
  return false
}

function isNearDuplicateTooltipSection(mainHtml: string, sectionHtml: string): boolean {
  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .replace(/\d+(?:[.,]\d+)?/g, '')
      .replace(/[^a-zàâäçéèêëîïôöùûüÿñæœ\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const mainPlain = normalize(normalizeTooltipPlainText(mainHtml))
  const sectionPlain = normalize(normalizeTooltipPlainText(sectionHtml))
  if (!mainPlain || !sectionPlain) return false
  const firstSentence = (value: string): string => {
    const idx = value.search(/[.!?]/)
    return (idx >= 0 ? value.slice(0, idx) : value).trim()
  }
  const mainFirst = firstSentence(mainPlain)
  const sectionFirst = firstSentence(sectionPlain)
  if (mainFirst.length < 30 || sectionFirst.length < 30) return false
  if (mainFirst === sectionFirst) return true
  if (mainPlain.includes(sectionFirst) || sectionPlain.includes(mainFirst)) return true
  return false
}

function buildUniqueSupplementalSections(mainHtml: string, sections: string[]): string[] {
  const mainPlain = normalizeTooltipPlainText(mainHtml).replace(/\s+/g, ' ').trim()
  const seen = new Set<string>()
  const out: string[] = []
  for (const section of sections) {
    const supplemental = extractSupplementalPassiveSection(mainHtml, section)
      .replace(/^(?:<br\s*\/?>\s*)+/i, '')
      .trim()
    if (!supplemental) continue
    const fragments = supplemental
      .split(/<br\s*\/?>\s*<br\s*\/?>/i)
      .map((fragment) => fragment.trim())
      .filter(Boolean)
    const filteredFragments = fragments.filter((fragment) => {
      const fragmentPlain = normalizeTooltipPlainText(fragment).replace(/\s+/g, ' ').trim()
      if (!fragmentPlain) return false
      return !mainPlain.includes(fragmentPlain)
    })
    const resolvedSection = filteredFragments.length > 0
      ? filteredFragments.join('<br><br>')
      : supplemental
    const plain = normalizeTooltipPlainText(resolvedSection).replace(/\s+/g, ' ').trim()
    if (
      /:\s*$/.test(plain) ||
      /\+\s*(puissance|dégâts d'attaque|attack damage)\.?$/i.test(plain)
    ) {
      continue
    }
    if (/\bmoins de\s+unités\b/i.test(plain) || /\bwithin\s+units\b/i.test(plain)) {
      continue
    }
    const normalizeForCompare = (value: string): string =>
      value
        .toLowerCase()
        .replace(/\d+(?:[.,]\d+)?/g, '')
        .replace(/[^a-zàâäçéèêëîïôöùûüÿñæœ\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    const mainCompare = normalizeForCompare(mainPlain)
    const sectionCompare = normalizeForCompare(plain)
    if (mainCompare && sectionCompare) {
      const prefixLen = Math.min(90, mainCompare.length, sectionCompare.length)
      if (prefixLen >= 50 && mainCompare.slice(0, prefixLen) === sectionCompare.slice(0, prefixLen)) {
        continue
      }
    }
    if (!plain || plain === mainPlain || seen.has(plain)) continue
    seen.add(plain)
    out.push(resolvedSection)
  }
  return out
}

function resolveSpellTooltipContent(args: {
  ddSpell: ChampionSpell
  cdSpell: CDragonChampionSpell
  binSpell: Record<string, unknown> | null | undefined
  stringTable: StringTableEntries
  sharedVars: Map<string, string>
}): { main: string; detailRaws: string[] } {
  const { ddSpell, cdSpell, binSpell, stringTable, sharedVars } = args
  const ddSections = splitTooltipSections(String(ddSpell.tooltip ?? ''))
  const ddMain = (ddSections[0] ?? String(ddSpell.tooltip ?? '')).trim()
  const ddDetailRaws = ddSections.slice(1)

  const ddParsed = ddMain
    ? parseTooltip(ddMain, ddSpell, cdSpell, binSpell, sharedVars)
    : { descriptionText: '' }
  const needsStringTable =
    !ddMain || isMetaDdragonTooltip(ddMain) || isBrokenTooltipText(ddParsed.descriptionText)

  if (!needsStringTable) {
    return { main: ddMain, detailRaws: ddDetailRaws }
  }

  const gameMode = resolveGameModeInteger(binSpell)
  const lookupKeys = buildSpellStringTableLookupKeys(ddSpell, binSpell, gameMode)
  const spellId = String(ddSpell.id ?? '').trim().toLowerCase()
  const scriptName = String(binSpell?.mScriptName ?? '').trim().toLowerCase()

  let main = ''
  let bestScore = -1
  for (const key of lookupKeys) {
    if (!isUsableSpellTooltipKey(key)) continue
    const candidate = lookupStringTableEntry(stringTable, key)
    if (!candidate || isMetaDdragonTooltip(candidate)) continue
    const normalized = normalizeStringTableTooltipSection(candidate, stringTable, gameMode)
    const score = scorePassiveTooltipCandidate(normalized)
    if (score > bestScore) {
      bestScore = score
      main = normalized
    }
  }

  if (!main) {
    main =
      lookupStringTableEntry(stringTable, `spell_${spellId}_summary`) ||
      lookupStringTableEntry(
        stringTable,
        scriptName ? `generatedtip_spell_${scriptName}_description` : ''
      ) ||
      String(ddSpell.description ?? '').trim()
  }

  const detailRaws: string[] = [...ddDetailRaws]
  for (const key of [
    `spell_${spellId}_tooltipextended`,
    scriptName ? `spell_${scriptName}_tooltipextended` : '',
    extractPassiveTooltipLocKeys(binSpell).extendedKey ?? '',
  ]) {
    if (!key) continue
    const candidate = lookupStringTableEntry(stringTable, key)
    if (!candidate || isMetaDdragonTooltip(candidate) || detailRaws.includes(candidate)) continue
    detailRaws.push(candidate)
  }

  return {
    main,
    detailRaws: detailRaws
      .map((section) => normalizeStringTableTooltipSection(section, stringTable, gameMode))
      .filter((section) => section.length > 0 && !isMetaDdragonTooltip(section)),
  }
}

function findPassiveBinSpell(
  championBin: ChampionBinJson | null,
  championId: string
): Record<string, unknown> | null {
  if (!championBin) return null
  const id = normalizeChampionBinId(championId)

  let bestSpell: Record<string, unknown> | null = null
  let bestScore = -1
  for (const value of Object.values(championBin)) {
    if (!value || typeof value !== 'object') continue
    const spell = asObject(value.mSpell)
    if (Object.keys(spell).length === 0) continue
    const locKeys = extractPassiveTooltipLocKeys(spell)
    const tooltipKey = String(locKeys.tooltipKey ?? '').toLowerCase()
    if (!tooltipKey || !tooltipKey.includes('passive')) continue
    if (tooltipKey.endsWith('_summary') || tooltipKey.endsWith('summary')) continue
    let score = 6
    if (tooltipKey.includes('_tooltip')) score += 8
    if (Object.keys(asObject(spell.mSpellCalculations)).length > 0) score += 5
    if (Array.isArray(spell.DataValues) && spell.DataValues.length > 0) score += 3
    const calcKeys = Object.keys(asObject(spell.mSpellCalculations)).map((k) => k.toLowerCase())
    if (calcKeys.some((k) => k.includes('minionad') || k.includes('championad') || k.includes('passivemanacalc'))) {
      score += 12
    }
    if (score > bestScore) {
      bestScore = score
      bestSpell = spell
    }
  }
  if (bestSpell) return bestSpell

  const direct = findBinSpellForDDragon(championBin, [
    `${championId}Passive`,
    `${id}passive`,
    'Passive',
    'DeadlyVenom',
    'Deadly_Venom',
    'TwitchDeadlyVenomMarker',
  ])
  if (direct) return direct

  let venomBestSpell: Record<string, unknown> | null = null
  let venomBestScore = -1
  for (const value of Object.values(championBin)) {
    if (!value || typeof value !== 'object') continue
    const spell = asObject(asObject(value).mSpell)
    if (Object.keys(spell).length === 0) continue
    const calculations = asObject(spell.mSpellCalculations)
    const hasDamagePerSecond = Object.keys(calculations).some(
      (key) => key.toLowerCase() === 'damagepersecond'
    )
    if (!hasDamagePerSecond) continue
    const dataValues = extractBinDataValues(spell, DEFAULT_ABILITY_MAX_RANK)
    const hasStacks = dataValues.some((v) => v.name.toLowerCase() === 'maxstacks')
    if (!hasStacks) continue
    const score = dataValues.length + Object.keys(calculations).length
    if (score > venomBestScore) {
      venomBestScore = score
      venomBestSpell = spell
    }
  }
  return venomBestSpell
}

const PASSIVE_VENOM_LABELS: Record<
  SupportedLang,
  { stacksDuration: string; perStackLine: string; maxStacksLine: string }
> = {
  fr_FR: {
    stacksDuration: 'Les stacks durent {duration} s (maximum {stacks}).',
    perStackLine:
      'Par stack : {perSecond} pts de dégâts bruts par seconde ({perStackTotal} sur la durée, selon le niveau).',
    maxStacksLine: 'À {stacks} stacks : {total} pts de dégâts bruts au total sur la durée (selon le niveau).',
  },
  en_US: {
    stacksDuration: 'Stacks last {duration} seconds (up to {stacks}).',
    perStackLine:
      'Per stack: {perSecond} true damage per second ({perStackTotal} over the duration, by level).',
    maxStacksLine: 'At {stacks} stacks: {total} total true damage over the duration (by level).',
  },
}

function applyPassiveLabelTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''))
}

function buildPassiveVenomDetailFromBin(
  binSpell: Record<string, unknown>,
  lang: SupportedLang
): { descriptionHtml: string; descriptionText: string } | null {
  const dataValues = extractBinDataValues(binSpell, PASSIVE_CHAMPION_LEVELS.length)
  const calcOptions: BinCalculationBuildOptions = {
    maxRank: PASSIVE_CHAMPION_LEVELS.length,
    isPassive: true,
    binSpell,
    htmlRatios: true,
  }
  const calculations = extractBinCalculations(binSpell, dataValues, calcOptions)
  const perSecond = calculations.find((c) => c.key.toLowerCase() === 'damagepersecond')
  const perStackTotal = calculations.find((c) => c.key.toLowerCase() === 'damagepersecondmax')
  const grandTotal = calculations.find((c) => c.key.toLowerCase() === 'damagemaxtotal')
  if (!perSecond?.expressionHtml && !perSecond?.expression) return null

  const labels = PASSIVE_VENOM_LABELS[lang]
  const duration = firstScalarFromDataValues(dataValues, 'Duration') ?? 6
  const stacks = firstScalarFromDataValues(dataValues, 'MaxStacks') ?? 6
  const perSecondHtml = wrapTrueDamageHtml(perSecond.expressionHtml || perSecond.expression)
  const perStackTotalHtml = wrapTrueDamageHtml(
    perStackTotal?.expressionHtml || perStackTotal?.expression || ''
  )
  const grandTotalHtml = wrapTrueDamageHtml(grandTotal?.expressionHtml || grandTotal?.expression || '')

  const htmlParts = [
    applyPassiveLabelTemplate(labels.stacksDuration, { duration, stacks }),
    applyPassiveLabelTemplate(labels.perStackLine, { perSecond: perSecondHtml, perStackTotal: perStackTotalHtml }),
    applyPassiveLabelTemplate(labels.maxStacksLine, { stacks, total: grandTotalHtml }),
  ].filter(Boolean)

  const textParts = [
    applyPassiveLabelTemplate(labels.stacksDuration, { duration, stacks }),
    applyPassiveLabelTemplate(labels.perStackLine, {
      perSecond: perSecond.expression || '',
      perStackTotal: perStackTotal?.expression || '',
    }),
    applyPassiveLabelTemplate(labels.maxStacksLine, {
      stacks,
      total: grandTotal?.expression || '',
    }),
  ].filter(Boolean)

  return {
    descriptionHtml: htmlParts.join('<br><br>'),
    descriptionText: textParts.join('\n\n'),
  }
}

function parseTooltip(
  raw: string,
  ddSpell: ChampionSpell,
  cdSpell: CDragonChampionSpell,
  binSpell?: Record<string, unknown> | null,
  sharedVars?: Map<string, string>,
  options?: { isPassive?: boolean }
): { descriptionParsed: string; unresolvedVariables: string[]; descriptionText: string } {
  if (!raw) return { descriptionParsed: '', unresolvedVariables: [], descriptionText: '' }
  const normalizedRaw = normalizeAtVariablesToMustache(normalizeRiotInlineIconTokens(raw))
  const vars = buildSpellVariableMap(ddSpell, cdSpell, binSpell, sharedVars, options)
  const unresolved = new Set<string>()
  const openedTags: string[] = []

  const lookupVar = (rawValue: string): string | null => {
    const base = rawValue.toLowerCase()
    const candidates = new Set<string>([base, base.replace(/[^a-z0-9]/g, '')])
    const baseWithoutDecimalSuffix = base.replace(/\.\d+$/, '')
    if (baseWithoutDecimalSuffix !== base) {
      candidates.add(baseWithoutDecimalSuffix)
      candidates.add(baseWithoutDecimalSuffix.replace(/[^a-z0-9]/g, ''))
    }
    const colonIndex = base.lastIndexOf(':')
    if (colonIndex >= 0 && colonIndex < base.length - 1) {
      const tail = base.slice(colonIndex + 1)
      candidates.add(tail)
      candidates.add(tail.replace(/[^a-z0-9]/g, ''))
    }
    const dotIndex = base.lastIndexOf('.')
    if (dotIndex >= 0 && dotIndex < base.length - 1) {
      const tail = base.slice(dotIndex + 1)
      candidates.add(tail)
      candidates.add(tail.replace(/[^a-z0-9]/g, ''))
    }
    for (const candidate of candidates) {
      const value = vars.get(candidate)
      if (value != null) return value
    }
    return null
  }

  const resolveExpression = (expressionRaw: string): string | null => {
    const expression = expressionRaw.trim()
    if (!expression) return null

    const direct = lookupVar(expression)
    if (direct != null) return direct

    const normalized = expression.replace(/\s+/g, '')
    const opMatch = normalized.match(
      /^([a-zA-Z0-9_:.-]+)([+\-*/])(-?\d+(?:\.\d+)?)$/
    ) ?? normalized.match(
      /^([a-zA-Z0-9_:.-]+|[-+]?\d*\.?\d+)([+\-*/])([a-zA-Z0-9_:.-]+|[-+]?\d*\.?\d+)$/
    )
    if (!opMatch) return null

    const leftRaw = opMatch[1]
    const operator = opMatch[2]
    const rightRaw = opMatch[3]
    const leftVar = lookupVar(leftRaw)
    const rightVar = lookupVar(rightRaw)
    const parseNum = (raw: string): number => {
      const trimmed = raw.trim()
      if (/^-\.\d+$/.test(trimmed)) return -Number(`0${trimmed}`)
      if (/^\.\d+$/.test(trimmed)) return Number(`0${trimmed}`)
      return Number(trimmed)
    }
    const leftNum = parseNum(leftRaw)
    const rightNum = parseNum(rightRaw)

    const computeSeries = (series: number[], scalar: number, scalarLeft: boolean): string => {
      const computed = series.map((n) =>
        scalarLeft ? applyOperation(scalar, operator, n) : applyOperation(n, operator, scalar)
      )
      return formatValueSeries(computed)
    }

    if (leftVar != null && Number.isFinite(rightNum)) {
      const series = parseNumberSeries(leftVar)
      if (series.length > 0) return computeSeries(series, rightNum, false)
      const value = Number(leftVar)
      if (Number.isFinite(value)) return formatResolvedNumber(applyOperation(value, operator, rightNum))
    }

    if (rightVar != null && Number.isFinite(leftNum)) {
      const series = parseNumberSeries(rightVar)
      if (series.length > 0) return computeSeries(series, leftNum, true)
      const value = Number(rightVar)
      if (Number.isFinite(value)) return formatResolvedNumber(applyOperation(leftNum, operator, value))
    }

    if (leftVar != null && rightVar != null) {
      const leftSeries = parseNumberSeries(leftVar)
      const rightSeries = parseNumberSeries(rightVar)
      if (leftSeries.length > 0 && rightSeries.length > 0) {
        const len = Math.min(leftSeries.length, rightSeries.length)
        const out: string[] = []
        for (let i = 0; i < len; i += 1) {
          out.push(formatResolvedNumber(applyOperation(leftSeries[i], operator, rightSeries[i])))
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

  let parsed = normalizedRaw.replace(/<\s*br\s*\/?>/gi, '___TOOLTIP_BR___')

  parsed = parsed.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression: string) => {
    const resolved = resolveExpression(String(expression))
    if (resolved == null) {
      const exp = expression.trim()
      unresolved.add(exp)
      if (exp.toLowerCase().includes('spellmodifier') || exp.toLowerCase().includes('append')) {
        return ''
      }
      if (exp.toLowerCase().includes('displayname')) {
        const display = lookupVar(exp)
        if (display != null) return display
      }
      if (exp.includes('{{') || exp.includes('}}')) return ''
      return ''
    }
    return resolved
  })

  parsed = parsed.replace(/<\s*([a-zA-Z0-9_]+)\s*>/g, (_match, rawTag: string) => {
    const tag = rawTag.toLowerCase()
    const meta = TOOLTIP_TAG_MAP[tag]
    const className = meta?.className ?? `tooltip-tag tooltip-tag-${tag.replace(/[^a-z0-9_-]/g, '')}`
    openedTags.push(tag)
    const icon = meta?.icon
      ? `<span class="tooltip-icon tooltip-icon-${meta.icon}" aria-hidden="true"></span> `
      : ''
    return `<span class="${className}">${icon}`
  })
  parsed = parsed.replace(/<\s*\/\s*([a-zA-Z0-9_]+)\s*>/g, (_match, rawTag: string) => {
    const tag = rawTag.toLowerCase()
    if (tag === 'span') return '</span>'
    const idx = openedTags.lastIndexOf(tag)
    if (idx === -1) return ''
    openedTags.splice(idx, 1)
    return '</span>'
  })
  if (openedTags.length > 0) {
    parsed += '</span>'.repeat(openedTags.length)
  }

  parsed = parsed.replace(/___TOOLTIP_BR___/g, '<br>')
  parsed = cleanupTooltipArtifacts(parsed)

  return {
    descriptionParsed: normalizeKaynFormMarkupHtml(parsed),
    unresolvedVariables: Array.from(unresolved),
    descriptionText: normalizeTooltipPlainText(parsed),
  }
}

/** Kayn Shadow Assassin (blue) / Darkin Slayer (red) — locale-agnostic label matching. */
function normalizeKaynFormMarkupHtml(html: string): string {
  if (!html) return ''
  let out = String(html)
  out = out.replace(/<font\s+color=["']#fe5c50["']>/gi, '<span class="kayn-form-darkin">')
  out = out.replace(/<font\s+color=["']#8484fb["']>/gi, '<span class="kayn-form-shadow">')
  out = out.replace(/<\/font>/gi, '</span>')
  out = out.replace(
    /<span class="keyword-major">([^<]*)<\/span>/gi,
    (match, inner: string) => {
      if (/Shadow Assassin|Assassin de l['']ombre/i.test(inner)) {
        return `<span class="kayn-form-shadow">${inner}</span>`
      }
      if (/Darkin Slayer|Tueur [Dd]arkin/i.test(inner)) {
        return `<span class="kayn-form-darkin">${inner}</span>`
      }
      return match
    }
  )
  return out
}

type SupportedLang = (typeof SUPPORTED_LANGS)[number]

const SPELL_STAT_LABELS: Record<SupportedLang, Record<string, string>> = {
  fr_FR: {
    cost: 'COÛT',
    cooldown: 'DÉLAI DE RÉCUPÉRATION',
    castTime: 'TEMPS D\'INCANTATION',
    targetRange: 'PORTÉE CIBLE',
    range: 'PORTÉE',
    effectRadius: 'RAYON D\'EFFET',
  },
  en_US: {
    cost: 'COST',
    cooldown: 'COOLDOWN',
    castTime: 'CAST TIME',
    targetRange: 'TARGET RANGE',
    range: 'RANGE',
    effectRadius: 'EFFECT RADIUS',
  },
}

const TICK_STAT_LABELS: Record<SupportedLang, Record<string, string>> = {
  fr_FR: {
    maxHpMagicDamage: 'Dégâts magiques totaux',
    maxHpMagicDamagePerTick: 'Dégâts magiques par tick',
    minDamage: 'Dégâts minimum totaux',
    minDamagePerTick: 'Dégâts minimum par tick',
    monsterDamageCap: 'Plafond de dégâts (monstres)',
    monsterDamageCapPerTick: 'Plafond par tick (monstres)',
  },
  en_US: {
    maxHpMagicDamage: 'Total Magic Damage',
    maxHpMagicDamagePerTick: 'Magic Damage Per Tick',
    minDamage: 'Total Minimum/Minion Damage',
    minDamagePerTick: 'Minimum/Minion Damage Per Tick',
    monsterDamageCap: 'Total Monster Damage Cap',
    monsterDamageCapPerTick: 'Monster Damage Cap Per Tick',
  },
}

const PARTYPE_RESOURCE_LABELS: Record<SupportedLang, Record<string, string>> = {
  fr_FR: {
    Mana: 'Mana',
    Energy: 'Énergie',
    Fury: 'Fureur',
    Rage: 'Rage',
    Ferocity: 'Férocité',
    Heat: 'Chaleur',
    BloodWell: 'Puits de sang',
    GnarFury: 'Fureur',
    Shields: 'Bouclier',
    Wind: 'Vents',
    RunicPower: 'Puissance runique',
    Flow: 'Flux',
    Courage: 'Courage',
  },
  en_US: {
    Mana: 'Mana',
    Energy: 'Energy',
    Fury: 'Fury',
    Rage: 'Rage',
    Ferocity: 'Ferocity',
    Heat: 'Heat',
    BloodWell: 'Blood Well',
    GnarFury: 'Fury',
    Shields: 'Shield',
    Wind: 'Wind',
    RunicPower: 'Runic Power',
    Flow: 'Flow',
    Courage: 'Courage',
  },
}

const MAX_HP_DAMAGE_SUFFIX: Record<SupportedLang, string> = {
  fr_FR: 'des PV max de la cible',
  en_US: "of target's max health",
}

function resolveLang(lang: string): SupportedLang {
  return lang === 'fr_FR' ? 'fr_FR' : 'en_US'
}

function formatPercentFromRatio(ratio: number): string {
  const pct = ratio <= 1 && ratio > 0 ? ratio * 100 : ratio
  return `${formatResolvedNumber(pct)}%`
}

function wrapMagicDamageHtml(text: string): string {
  if (!text) return ''
  return `<span class="dmg-magic"><span class="tooltip-icon tooltip-icon-magic" aria-hidden="true"></span> ${text}</span>`
}

function splitTooltipSections(raw: string): string[] {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return []
  return trimmed
    .split(/<br\s*\/?>\s*<br\s*\/?>/i)
    .map((section) => section.trim())
    .filter(Boolean)
}

function binDataValueMap(
  binSpell: Record<string, unknown> | null | undefined,
  maxRank: number
): Map<string, number[]> {
  const spellBin = asObject(binSpell?.mSpell ?? binSpell)
  const map = new Map<string, number[]>()
  extractBinDataValues(spellBin, maxRank).forEach((entry) => {
    map.set(entry.name.toLowerCase(), trimByMaxRank(entry.values, maxRank))
  })
  return map
}

function resolveSpellResourceLabel(
  ddSpell: ChampionSpell,
  championPartype: string,
  lang: SupportedLang
): string {
  const costType = String(ddSpell.costType ?? ddSpell.resource ?? '')
    .replace(/\{\{[^}]+\}\}/g, '')
    .trim()
    .toLowerCase()

  if (costType.includes('energy') || costType.includes('énergie')) {
    return lang === 'fr_FR' ? 'Énergie' : 'Energy'
  }
  if (costType.includes('mana')) {
    return lang === 'fr_FR' ? 'Mana' : 'Mana'
  }
  if (costType.includes('fury') || costType.includes('fureur')) {
    return lang === 'fr_FR' ? 'Fureur' : 'Fury'
  }
  if (costType.includes('rage')) {
    return lang === 'fr_FR' ? 'Rage' : 'Rage'
  }
  if (costType.includes('ferocity') || costType.includes('férocité')) {
    return lang === 'fr_FR' ? 'Férocité' : 'Ferocity'
  }

  const partype = String(championPartype ?? '').trim()
  const fromPartype = PARTYPE_RESOURCE_LABELS[lang][partype]
  if (fromPartype) return fromPartype

  if (costType) return costType

  return lang === 'fr_FR' ? 'Mana' : 'Mana'
}

function buildSpellHeaderStats(args: {
  ddSpell: ChampionSpell
  binSpell: Record<string, unknown> | null | undefined
  championPartype?: string
  lang: SupportedLang
}): Array<{ key: string; label: string; valueText: string; valueHtml?: string }> {
  const { ddSpell, binSpell, championPartype = '', lang } = args
  const labels = SPELL_STAT_LABELS[lang]
  const maxRank = Number(ddSpell.maxrank ?? 5)
  const stats: Array<{ key: string; label: string; valueText: string; valueHtml?: string }> = []
  const spellBin = asObject(binSpell?.mSpell ?? binSpell)
  const dataByName = binDataValueMap(binSpell, maxRank)

  const cost = trimByMaxRank(parseNumberArray(ddSpell.cost), maxRank)
  const hasNonZeroCost = cost.some((value) => Number(value) > 0)
  if (cost.length > 0 && hasNonZeroCost) {
    const resourceLabel = resolveSpellResourceLabel(ddSpell, championPartype, lang)
    const valueText = `${formatValueSeries(cost, ' / ')} ${resourceLabel}`.trim()
    stats.push({ key: 'cost', label: labels.cost, valueText, valueHtml: valueText })
  }

  const cooldown = trimByMaxRank(parseNumberArray(ddSpell.cooldown), maxRank)
  if (cooldown.length > 0) {
    const valueText = formatValueSeries(cooldown, ' / ')
    stats.push({ key: 'cooldown', label: labels.cooldown, valueText, valueHtml: valueText })
  }

  const castFrame = Number(spellBin.castFrame ?? 0)
  const castSeconds = castFrame > 0 ? castFrame / 30 : 0
  if (castSeconds >= 0.5) {
    const castValue = `${formatResolvedNumber(castSeconds)} sec`
    stats.push({ key: 'castTime', label: labels.castTime, valueText: castValue, valueHtml: castValue })
  }

  const rectangleLength = dataByName.get('rectanglelength') ?? []
  const finalLength = dataByName.get('finaltickrectanglelength') ?? []

  const spellRange = trimByMaxRank(parseNumberArray(ddSpell.range), maxRank)
  if (spellRange.length > 0 && rectangleLength.length === 0) {
    const valueText = formatValueSeries(spellRange, ' / ')
    stats.push({ key: 'targetRange', label: labels.targetRange, valueText, valueHtml: valueText })
  }

  const dashSpeed = dataByName.get('dashspeed') ?? []
  const dashSpeedScaling = dataByName.get('dashspeedscaling') ?? []
  if (dashSpeed.length > 0) {
    const base = formatValueSeries(dashSpeed, ' / ')
    let valueText = base
    if (dashSpeedScaling.length > 0) {
      const scaleRaw = dashSpeedScaling[0] ?? 0
      const scalePct =
        scaleRaw > 0 && scaleRaw <= 1 ? formatPercentFromRatio(scaleRaw) : `${formatResolvedNumber(scaleRaw)}%`
      const speedLabel = lang === 'fr_FR' ? 'vitesse de déplacement' : 'movement speed'
      valueText = `${base} (+ ${scalePct} ${speedLabel})`
    }
    const speedLabel = lang === 'fr_FR' ? 'VITESSE' : 'SPEED'
    stats.push({ key: 'dashSpeed', label: speedLabel, valueText, valueHtml: valueText })
  }

  if (rectangleLength.length > 0) {
    const start = rectangleLength[0] ?? 0
    const end = finalLength[0] ?? start
    const valueText =
      finalLength.length > 0 && end !== start
        ? `${formatResolvedNumber(start)} • ${formatResolvedNumber(end)}`
        : formatValueSeries(rectangleLength, ' / ')
    stats.push({ key: 'targetRange', label: labels.targetRange, valueText, valueHtml: valueText })
  }

  const breathDuration = dataByName.get('breathduration') ?? []
  const moveSpeedReduction = dataByName.get('movementspeedreduction') ?? []
  if (breathDuration.length > 0 && moveSpeedReduction.length > 0) {
    const duration = breathDuration[0] ?? 0
    const movePct = formatPercentFromRatio(moveSpeedReduction[0] ?? 0)
    const valueText = `${formatResolvedNumber(duration)} sec × ${movePct} movement speed`
    const valueHtml = `${formatResolvedNumber(duration)} sec × <span class="scale-ms">${movePct}</span>`
    stats.push({ key: 'range', label: labels.range, valueText, valueHtml })
  }

  const rectangleWidth = dataByName.get('rectanglewidth') ?? []
  if (rectangleWidth.length > 0) {
    const valueText = formatValueSeries(rectangleWidth, ' / ')
    stats.push({ key: 'effectRadius', label: labels.effectRadius, valueText, valueHtml: valueText })
  }

  return stats
}

function buildSpellTickStats(args: {
  ddSpell: ChampionSpell
  binSpell: Record<string, unknown> | null | undefined
  lang: SupportedLang
}): Array<{
  key: string
  label: string
  totalText: string
  totalHtml: string
  perTickText?: string
  perTickHtml?: string
}> {
  const { ddSpell, binSpell, lang } = args
  const labels = TICK_STAT_LABELS[lang]
  const maxRank = Number(ddSpell.maxrank ?? 5)
  const dataByName = binDataValueMap(binSpell, maxRank)
  const tickCount = Math.max(1, Math.round(dataByName.get('numberofticks')?.[0] ?? 1))
  const out: Array<{
    key: string
    label: string
    totalText: string
    totalHtml: string
    perTickText?: string
    perTickHtml?: string
  }> = []

  const percentPerTick = dataByName.get('percenthppertick') ?? []
  const maxPercentTooltip = dataByName.get('maxpercenthpperticktooltip') ?? []
  if (percentPerTick.length > 0 || maxPercentTooltip.length > 0) {
    const perTickSeries = percentPerTick.map((v) => formatPercentFromRatio(v))
    const totalSeries =
      maxPercentTooltip.length > 0
        ? maxPercentTooltip.map((v) => `${formatResolvedNumber(v)}%`)
        : percentPerTick.map((v) => formatPercentFromRatio(v * tickCount))
    const suffix = MAX_HP_DAMAGE_SUFFIX[lang]
    const joinPercentSeries = (parts: string[]): string =>
      parts.length > 0 && parts.every((p) => p === parts[0]) ? parts[0] : parts.join(' / ')
    const totalText = `${joinPercentSeries(totalSeries)} ${suffix}`
    const perTickText = `${joinPercentSeries(perTickSeries)} ${suffix}`
    out.push({
      key: 'maxHpMagicDamage',
      label: labels.maxHpMagicDamage,
      totalText,
      totalHtml: wrapMagicDamageHtml(totalText),
      perTickText,
      perTickHtml: wrapMagicDamageHtml(perTickText),
    })
  }

  const minPerTick = dataByName.get('minimumdamagepertick') ?? []
  if (minPerTick.length > 0) {
    const perTickText = formatValueSeries(minPerTick, ' / ')
    const totalText = formatValueSeries(
      minPerTick.map((v) => Math.round(v * tickCount)),
      ' / '
    )
    out.push({
      key: 'minDamage',
      label: labels.minDamage,
      totalText,
      totalHtml: totalText,
      perTickText: perTickText,
      perTickHtml: perTickText,
    })
  }

  const monsterPerTick = dataByName.get('monsterdamagepertickcap') ?? []
  if (monsterPerTick.length > 0) {
    const perTickText = formatValueSeries(monsterPerTick, ' / ')
    const totalText = formatValueSeries(
      monsterPerTick.map((v) => Math.round(v * tickCount)),
      ' / '
    )
    out.push({
      key: 'monsterDamageCap',
      label: labels.monsterDamageCap,
      totalText,
      totalHtml: totalText,
      perTickText: perTickText,
      perTickHtml: perTickText,
    })
  }

  return out
}

type ExportedStackCalculation = {
  key: string
  baseValues: number[]
  ratios: Array<{ stat: string; coefficient: number[] | number; type: string }>
}

type ExportedStackDefinition = {
  id: string
  scope: 'passive' | 'spell'
  spellSlot?: string
  label: string
  maxStacks: number
  statBonuses: Array<{
    stat: 'abilityPower' | 'attackDamage' | 'health' | 'armor' | 'magicResist' | 'attackSpeed'
    perStackKey: string
    isPercent?: boolean
  }>
  tooltipVars: Array<{ key: string; perStackKey: string }>
  damageBonuses?: Array<{ targetKey: string; perStackKey: string }>
}

function mapPerStackKeyToStat(
  key: string
): ExportedStackDefinition['statBonuses'][number]['stat'] | null {
  const lower = key.toLowerCase()
  if (lower === 'apperstack' || (lower.includes('ap') && lower.includes('stack'))) return 'abilityPower'
  if (lower.includes('ad') && lower.includes('stack')) return 'attackDamage'
  if (lower.includes('hp') && lower.includes('stack')) return 'health'
  if (lower.includes('armor') && lower.includes('stack') && !lower.includes('magic')) return 'armor'
  if (lower.includes('magicresist') && lower.includes('stack')) return 'magicResist'
  if (lower.includes('attackspeed') && lower.includes('stack')) return 'attackSpeed'
  return null
}

function findPerStackSourceForTotal(totalKey: string, perStackKeys: string[]): string | null {
  const normalizedTotal = totalKey.toLowerCase().replace(/^total/, '').replace(/fromstacks$/, '')
  for (const perStackKey of perStackKeys) {
    const normalizedPerStack = perStackKey.toLowerCase().replace(/perstack$/, '')
    if (
      normalizedTotal.includes(normalizedPerStack) ||
      normalizedPerStack.includes(normalizedTotal)
    ) {
      return perStackKey
    }
  }
  return perStackKeys[0] ?? null
}

function extractStackDefinition(args: {
  id: string
  label: string
  scope: 'passive' | 'spell'
  spellSlot?: string
  calculations: ExportedStackCalculation[]
  dataValues?: Array<{ name: string; values: number[] }>
}): ExportedStackDefinition | null {
  const perStackCalcs = args.calculations.filter((calculation) =>
    /perstack$/i.test(calculation.key)
  )
  if (perStackCalcs.length === 0) return null

  const statBonuses = perStackCalcs
    .map((calculation) => {
      const stat = mapPerStackKeyToStat(calculation.key)
      if (!stat) return null
      return {
        stat,
        perStackKey: calculation.key,
        isPercent: stat === 'attackSpeed',
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)

  const perStackKeys = perStackCalcs.map((calculation) => calculation.key)
  const tooltipVars = args.calculations
    .filter(
      (calculation) =>
        /^total.*stack/i.test(calculation.key) &&
        calculation.baseValues.length > 0 &&
        calculation.baseValues.every((value) => value === 0)
    )
    .map((calculation) => {
      const perStackKey = findPerStackSourceForTotal(calculation.key, perStackKeys)
      if (!perStackKey) return null
      return { key: calculation.key, perStackKey }
    })
    .filter((entry): entry is { key: string; perStackKey: string } => entry != null)

  if (statBonuses.length === 0 && tooltipVars.length === 0) {
    if (args.scope === 'spell') {
      const basicStacks = args.dataValues?.find(
        (entry) => String(entry.name).toLowerCase() === 'basicstacks'
      )
      if (basicStacks?.values?.length) {
        return {
          id: args.id,
          scope: 'spell',
          ...(args.spellSlot ? { spellSlot: args.spellSlot } : {}),
          label: args.label,
          maxStacks: 9999,
          statBonuses: [],
          tooltipVars: [],
          damageBonuses: [{ targetKey: 'totaldamage', perStackKey: 'basicstacks' }],
        }
      }
    }
    return null
  }

  return {
    id: args.scope === 'passive' ? 'passive' : args.id,
    scope: args.scope,
    ...(args.spellSlot ? { spellSlot: args.spellSlot } : {}),
    label: args.label,
    maxStacks: 9999,
    statBonuses,
    tooltipVars,
  }
}

function buildExportedSpell(args: {
  championId: string
  slotIndex: number
  ddSpell: ChampionSpell
  cdSpell: CDragonChampionSpell
  binSpell: Record<string, unknown> | null | undefined
  sharedVars: Map<string, string>
  stringTable: StringTableEntries
  championPartype?: string
  lang: SupportedLang
}): Record<string, unknown> {
  const {
    championId,
    slotIndex,
    ddSpell,
    cdSpell,
    binSpell,
    sharedVars,
    stringTable,
    championPartype = '',
    lang,
  } = args
  const spellImage = asObject(ddSpell.image)
  const resolvedSlot = normalizeSpellSlot(slotIndex)

  const { main: mainRaw, detailRaws } = resolveSpellTooltipContent({
    ddSpell,
    cdSpell,
    binSpell,
    stringTable,
    sharedVars,
  })

  const mainTooltip = parseTooltip(mainRaw, ddSpell, cdSpell, binSpell, sharedVars)
  const detailedParsed = detailRaws
    .map((section) => parseTooltip(section, ddSpell, cdSpell, binSpell, sharedVars))
    .filter(
      (section) =>
        !isBrokenTooltipText(section.descriptionText) &&
        !isDuplicateTooltipSection(mainTooltip.descriptionParsed, section.descriptionParsed) &&
        !isNearDuplicateTooltipSection(mainTooltip.descriptionParsed, section.descriptionParsed)
    )
  const detailedSections = buildUniqueSupplementalSections(
    mainTooltip.descriptionParsed,
    detailedParsed.map((section) => section.descriptionParsed)
  )
  const cleanedDetailedSections =
    String(ddSpell.id ?? '').toLowerCase() === 'illaoiw' &&
    normalizeTooltipPlainText(mainTooltip.descriptionParsed)
      .toLowerCase()
      .includes("les dégâts selon les pv s'élèvent au minimum")
      ? []
      : detailedSections
  const summaryParsed = String(ddSpell.description ?? '').trim()
    ? parseTooltip(String(ddSpell.description ?? ''), ddSpell, cdSpell, binSpell, sharedVars)
    : null

  const headerStats = buildSpellHeaderStats({ ddSpell, binSpell, championPartype, lang })
  const tickStats = buildSpellTickStats({ ddSpell, binSpell, lang })

  const maxRank =
    Number(ddSpell.maxrank ?? cdSpell.maxLevel ?? DEFAULT_ABILITY_MAX_RANK) || DEFAULT_ABILITY_MAX_RANK
  const binDataValues = extractBinDataValues(binSpell ?? {}, maxRank)
  const calculations = extractBinCalculations(binSpell ?? {}, binDataValues, {
    maxRank,
    slotIndex: slotIndex,
    ddSpell,
  })
  const basicStacksValue = binDataValues.find(
    (entry) => String(entry.name).toLowerCase() === 'basicstacks'
  )
  if (
    basicStacksValue?.values?.length &&
    !calculations.some((entry) => entry.key.toLowerCase() === 'basicstacks')
  ) {
    calculations.push({
      key: 'basicstacks',
      expression: '',
      expressionHtml: '',
      baseValues: basicStacksValue.values,
      ratios: [],
    })
  }
  const spellEffects = extractSpellEffects(ddSpell, cdSpell, binSpell).map((effect) => ({
    key: effect.key,
    values: effect.values,
  }))

  return {
    id: String(ddSpell.id ?? ''),
    slot: resolvedSlot,
    name: String(ddSpell.name ?? ''),
    maxRank,
    image: {
      full: String(spellImage.full ?? '') || `${championId}${resolvedSlot}.png`,
    },
    tooltipRaw: mainRaw,
    tooltipDetailRaws: detailRaws,
    calculations: calculations.map((calculation) => ({
      key: calculation.key,
      baseValues: calculation.baseValues,
      ratios: calculation.ratios,
    })),
    dataValues: binDataValues.map((entry) => ({
      name: entry.name,
      values: entry.values,
    })),
    spellEffects,
    ...(summaryParsed
      ? {
          summaryHtml: summaryParsed.descriptionParsed,
          summaryText: summaryParsed.descriptionText,
        }
      : {}),
    descriptionHtml: mainTooltip.descriptionParsed,
    descriptionParsed: mainTooltip.descriptionParsed,
    descriptionText: mainTooltip.descriptionText,
    parsedText: mainTooltip.descriptionText,
    ...(cleanedDetailedSections.length > 0
      ? {
          detailedTexts: cleanedDetailedSections,
          detailedText: cleanedDetailedSections
            .map((section) => normalizeTooltipPlainText(section))
            .join('\n\n'),
        }
      : {}),
    ...(headerStats.length > 0 ? { headerStats } : {}),
    ...(tickStats.length > 0 ? { tickStats } : {}),
  }
}

type ExportedTheorycraftSpell = ReturnType<typeof buildExportedSpell>

function parseApheliosWeaponTooltipSection(args: {
  tooltipRaw: string
  detailRaw?: string
  weaponKey: string
  weaponIndex: number
  championBin: ChampionBinJson | null
  stringTable: StringTableEntries
  sharedVars: Map<string, string>
}): { descriptionParsed: string; descriptionText: string; detailedTexts: string[] } | null {
  const { tooltipRaw, detailRaw, weaponKey, championBin, stringTable, sharedVars } = args
  const gameMode = 1
  const normalized = normalizeStringTableTooltipSection(tooltipRaw, stringTable, gameMode)
  if (!normalized || isMetaDdragonTooltip(normalized)) return null

  const binSpell = findBinSpellForDDragon(championBin, [`Aphelios${weaponKey}Q`])
  const ddSpell: ChampionSpell = { id: `Aphelios${weaponKey}Q`, maxrank: DEFAULT_ABILITY_MAX_RANK }
  const prepared = normalizeAtVariablesToMustache(sanitizeRiotTooltipMarkup(normalized))
  const main = parseTooltip(prepared, ddSpell, {}, binSpell, sharedVars)
  if (isBrokenTooltipText(main.descriptionText)) return null

  const detailedTexts: string[] = []
  if (detailRaw) {
    const detailNorm = normalizeStringTableTooltipSection(detailRaw, stringTable, gameMode)
    const detailPrepared = normalizeAtVariablesToMustache(sanitizeRiotTooltipMarkup(detailNorm))
    const detail = parseTooltip(detailPrepared, ddSpell, {}, binSpell, sharedVars)
    if (
      detail.descriptionParsed &&
      !isBrokenTooltipText(detail.descriptionText) &&
      !isDuplicateTooltipSection(main.descriptionParsed, detail.descriptionParsed)
    ) {
      detailedTexts.push(detail.descriptionParsed)
    }
  }

  return {
    descriptionParsed: main.descriptionParsed,
    descriptionText: main.descriptionText,
    detailedTexts,
  }
}

function buildApheliosWeaponAbilitySections(args: {
  championBin: ChampionBinJson | null
  stringTable: StringTableEntries
  sharedVars: Map<string, string>
}): Array<{
  name: string
  descriptionHtml: string
  descriptionText: string
  detailedTexts: string[]
}> {
  const { championBin, stringTable, sharedVars } = args
  const sections: Array<{
    name: string
    descriptionHtml: string
    descriptionText: string
    detailedTexts: string[]
  }> = []

  APHELIOS_WEAPON_KEYS.forEach((weaponKey, index) => {
    const weaponIndex = index + 1
    const tooltipRaw =
      lookupStringTableEntry(stringTable, `spell_apheliosq_tooltip_${weaponIndex}`) ||
      lookupStringTableEntry(stringTable, `Spell_ApheliosQ_Tooltip_${weaponIndex}`)
    if (!tooltipRaw) return

    const detailRaw =
      lookupStringTableEntry(stringTable, `spell_apheliosq_tooltipextended_${weaponIndex}`) ||
      lookupStringTableEntry(stringTable, `Spell_ApheliosQ_TooltipExtended_${weaponIndex}`)

    const parsed = parseApheliosWeaponTooltipSection({
      tooltipRaw,
      detailRaw: detailRaw ?? undefined,
      weaponKey,
      weaponIndex,
      championBin,
      stringTable,
      sharedVars,
    })
    if (!parsed) return

    const loreName =
      lookupStringTableEntry(stringTable, `apheliosgun_lorename_${weaponIndex}`) ||
      lookupStringTableEntry(stringTable, `ApheliosGun_LoreName_${weaponIndex}`) ||
      weaponKey
    const name = stripInlineHtmlTags(loreName) || weaponKey

    sections.push({
      name,
      descriptionHtml: parsed.descriptionParsed,
      descriptionText: parsed.descriptionText,
      detailedTexts: parsed.detailedTexts,
    })
  })

  return sections
}

function buildApheliosEWeaponSections(args: {
  championBin: ChampionBinJson | null
  stringTable: StringTableEntries
  sharedVars: Map<string, string>
}): Array<{ name: string; descriptionHtml: string; descriptionText: string }> {
  const { championBin, stringTable, sharedVars } = args
  const sections: Array<{ name: string; descriptionHtml: string; descriptionText: string }> = []
  const gameMode = 1

  APHELIOS_WEAPON_KEYS.forEach((weaponKey, index) => {
    const weaponIndex = index + 1
    const longRaw =
      lookupStringTableEntry(stringTable, `spell_apheliose_long_${weaponIndex}`) ||
      lookupStringTableEntry(stringTable, `Spell_ApheliosE_Long_${weaponIndex}`)
    if (!longRaw) return

    const normalized = normalizeStringTableTooltipSection(longRaw, stringTable, gameMode)
    const binSpell = findBinSpellForDDragon(championBin, [`Aphelios${weaponKey}Q`, `Aphelios${weaponKey}`])
    const ddSpell: ChampionSpell = { id: `Aphelios${weaponKey}`, maxrank: 1 }
    const prepared = normalizeAtVariablesToMustache(sanitizeRiotTooltipMarkup(normalized))
    const parsed = parseTooltip(prepared, ddSpell, {}, binSpell, sharedVars)
    if (!parsed.descriptionParsed || isBrokenTooltipText(parsed.descriptionText)) return

    const loreName =
      lookupStringTableEntry(stringTable, `apheliosgun_lorename_${weaponIndex}`) || weaponKey
    const name = stripInlineHtmlTags(loreName) || weaponKey
    sections.push({
      name,
      descriptionHtml: parsed.descriptionParsed,
      descriptionText: parsed.descriptionText,
    })
  })

  return sections
}

function enrichApheliosSpells(
  spells: ExportedTheorycraftSpell[],
  args: {
    championBin: ChampionBinJson | null
    stringTable: StringTableEntries
    sharedVars: Map<string, string>
  }
): ExportedTheorycraftSpell[] {
  const weaponSections = buildApheliosWeaponAbilitySections(args)
  const eSections = buildApheliosEWeaponSections(args)
  if (weaponSections.length === 0 && eSections.length === 0) return spells

  return spells.map((spell) => {
    if (spell.slot === 'Q' && weaponSections.length > 0) {
      const descriptionHtml = weaponSections
        .map(
          (weapon) =>
            `<p class="tooltip-weapon-title"><strong>${weapon.name}</strong></p>${weapon.descriptionHtml}`
        )
        .join('<br><br>')
      const descriptionText = weaponSections
        .map((weapon) => `${weapon.name}\n${weapon.descriptionText}`)
        .join('\n\n')
      const detailedTexts = [
        ...(Array.isArray(spell.detailedTexts) ? spell.detailedTexts : []),
        ...weaponSections.flatMap((weapon) => weapon.detailedTexts),
      ].filter(Boolean)
      return {
        ...spell,
        descriptionHtml,
        descriptionParsed: descriptionHtml,
        descriptionText,
        parsedText: descriptionText,
        ...(detailedTexts.length > 0
          ? {
              detailedTexts,
              detailedText: detailedTexts
                .map((section) => normalizeTooltipPlainText(section))
                .join('\n\n'),
            }
          : {}),
      }
    }
    if (spell.slot === 'E' && eSections.length > 0) {
      const summaryHtml =
        lookupStringTableEntry(args.stringTable, 'spell_apheliose_summary') ||
        String(spell.summaryHtml ?? '')
      const descriptionHtml = eSections
        .map(
          (weapon) =>
            `<p class="tooltip-weapon-title"><strong>${weapon.name}</strong></p>${weapon.descriptionHtml}`
        )
        .join('<br><br>')
      const descriptionText = eSections
        .map((weapon) => `${weapon.name}\n${weapon.descriptionText}`)
        .join('\n\n')
      return {
        ...spell,
        ...(summaryHtml ? { summaryHtml, summaryText: stripInlineHtmlTags(summaryHtml) } : {}),
        descriptionHtml,
        descriptionParsed: descriptionHtml,
        descriptionText,
        parsedText: descriptionText,
      }
    }
    return spell
  })
}

function enrichSharedVarsWithSpellDisplayNames(
  shared: Map<string, string>,
  championId: string,
  spells: ChampionSpell[],
  stringTable: StringTableEntries
): void {
  const setDisplay = (token: string, label: string): void => {
    const normalized = token.toLowerCase()
    if (!normalized || !label) return
    shared.set(normalized, label)
    shared.set(normalized.replace(/[^a-z0-9]/g, ''), label)
    shared.set(`spell.${normalized}`, label)
  }

  spells.forEach((spell, idx) => {
    const name = String(spell.name ?? '').trim()
    if (!name) return
    const id = String(spell.id ?? '').trim().toLowerCase()
    const slot = normalizeSpellSlot(idx).toLowerCase()
    const tokens = [id, `${normalizeChampionBinId(championId)}${slot}`, id.replace(/clienttooltipwrapper$/i, '')]
    tokens.filter(Boolean).forEach((token) => setDisplay(`${token}:displayname`, name))
  })

  const id = normalizeChampionBinId(championId)
  for (const [key, value] of Object.entries(stringTable)) {
    if (!key.startsWith('generatedtip_spell_') || !key.endsWith('_displayname')) continue
    const script = key.slice('generatedtip_spell_'.length, -'_displayname'.length)
    if (!script.startsWith(id)) continue
    const label = String(value ?? '').trim()
    if (!label) continue
    setDisplay(`${script}:displayname`, label)
  }
}

function buildChampionSharedVariableMap(championBin: ChampionBinJson | null): Map<string, string> {
  const shared = new Map<string, string>()
  if (!championBin) return shared
  for (const value of Object.values(championBin)) {
    const wrapper = asObject(value)
    const spell = asObject(wrapper.mSpell)
    if (Object.keys(spell).length === 0) continue
    const scriptName = String(wrapper.mScriptName ?? '').trim().toLowerCase()
    const dataValues = extractBinDataValues(spell, DEFAULT_ABILITY_MAX_RANK)
    dataValues.forEach((entry) => {
      const key = entry.name.toLowerCase()
      const series = formatValueSeries(entry.values)
      shared.set(key, series)
      if (scriptName) {
        shared.set(`${scriptName}:${key}`, series)
        shared.set(`spell.${scriptName}:${key}`, series)
      }
    })
    const calculations = extractBinCalculations(spell, dataValues, {
      maxRank: DEFAULT_ABILITY_MAX_RANK,
    })
    calculations.forEach((calc) => {
      const rendered =
        calc.expressionHtml ||
        calc.expression ||
        (calc.baseValues.length > 0 ? formatValueSeries(calc.baseValues, ' / ') : '')
      if (!rendered) return
      const calcKey = calc.key.toLowerCase()
      if (!shared.has(calcKey)) {
        shared.set(calcKey, rendered)
      }
      if (scriptName) {
        shared.set(`${scriptName}:${calcKey}`, rendered)
        shared.set(`spell.${scriptName}:${calcKey}`, rendered)
      }
    })
  }
  return shared
}

function toChampionIndexEntry(champion: ChampionRecord): Record<string, unknown> {
  const tags = Array.isArray(champion.tags) ? champion.tags : []
  const roles = tags.map((t) => String(t)).filter(Boolean)
  const image = asObject(champion.image)
  const championId = String(champion.id ?? '')
  return {
    id: championId,
    key: Number(champion.key ?? 0),
    name: String(champion.name ?? ''),
    title: String(champion.title ?? ''),
    roles,
    tags: roles,
    image: {
      full: String(image.full ?? `${championId}.png`),
    },
  }
}

export class TheorycraftDataBuilderService {
  private readonly backendGameDir: string
  private readonly frontendGameDir: string
  private readonly frontendDataDir: string
  private readonly frontendPublicDir: string
  private readonly cdragonCacheDir: string

  constructor(
    backendGameDir: string = join(process.cwd(), 'data', 'game'),
    frontendGameDir: string = join(process.cwd(), '..', 'frontend', 'public', 'data', 'game'),
    frontendDataDir: string = join(process.cwd(), '..', 'frontend', 'public', 'data'),
    cdragonCacheDir: string = join(process.cwd(), 'data', 'theorycraft-cache'),
    frontendPublicDir: string = join(process.cwd(), '..', 'frontend', 'public')
  ) {
    this.backendGameDir = backendGameDir
    this.frontendGameDir = frontendGameDir
    this.frontendDataDir = frontendDataDir
    this.frontendPublicDir = frontendPublicDir
    this.cdragonCacheDir = cdragonCacheDir
  }

  private async readGameJson<T>(version: string, lang: string, filename: string): Promise<Result<T, AppError>> {
    const backendPath = join(this.backendGameDir, version, lang, filename)
    const backendRes = await FileManager.readJson<T>(backendPath)
    if (backendRes.isOk()) return backendRes

    const frontendPath = join(this.frontendGameDir, version, lang, filename)
    const frontendRes = await FileManager.readJson<T>(frontendPath)
    if (frontendRes.isOk()) return frontendRes

    return Result.err(backendRes.unwrapErr())
  }

  /**
   * championFull.json is the theorycraft build input (DDragon raw spells).
   * Download from Data Dragon when missing locally (e.g. after partial sync).
   */
  private async readChampionFull(
    version: string,
    lang: string
  ): Promise<Result<{ data: Record<string, ChampionRecord> }, AppError>> {
    const local = await this.readGameJson<{ data: Record<string, ChampionRecord> }>(
      version,
      lang,
      'championFull.json'
    )
    if (local.isOk()) return local

    console.warn(
      `[theorycraft] championFull.json not found for ${version}/${lang}, fetching from Data Dragon...`
    )
    const ddragon = new DataDragonService()
    const fetched = await ddragon.fetchChampionsFull(version, lang)
    if (fetched.isErr()) {
      return Result.err(
        new AppError(
          `championFull.json missing and Data Dragon fetch failed: ${fetched.unwrapErr().message}. Run "npm run sync:data" first.`,
          'DATA_ERROR',
          fetched.unwrapErr()
        )
      )
    }

    const payload = { data: fetched.unwrap() }
    const backendPath = join(this.backendGameDir, version, lang, 'championFull.json')
    const dirResult = await FileManager.ensureDir(join(backendPath, '..'))
    if (dirResult.isErr()) return Result.err(dirResult.unwrapErr())
    const writeResult = await FileManager.writeJson(backendPath, payload)
    if (writeResult.isErr()) return Result.err(writeResult.unwrapErr())

    console.log(`[theorycraft] cached championFull.json → ${backendPath}`)
    return Result.ok(payload)
  }

  /** DDragon championFull is backend-only build input; parsed exports live under champions/. */
  private async removeLegacyFrontendChampionExports(version: string): Promise<void> {
    const legacyFilenames = ['champion.json', 'championFull.json']
    await Promise.all(
      SUPPORTED_LANGS.flatMap((lang) =>
        legacyFilenames.map((filename) =>
          fs.rm(join(this.frontendGameDir, version, lang, filename), { force: true }).catch(() => undefined)
        )
      )
    )
  }

  private async writeJsonWithHash(
    absolutePath: string,
    data: unknown
  ): Promise<Result<{ relativePath: string; sha256: string; bytes: number }, AppError>> {
    try {
      const dirResult = await FileManager.ensureDir(join(absolutePath, '..'))
      if (dirResult.isErr()) return Result.err(dirResult.unwrapErr())
      const content = `${JSON.stringify(data, null, 2)}\n`
      await fs.writeFile(absolutePath, content, 'utf-8')
      const relativePath = relative(this.frontendPublicDir, absolutePath)
      return Result.ok({
        relativePath: relativePath.replace(/\\/g, '/'),
        sha256: toSha256(content),
        bytes: Buffer.byteLength(content, 'utf-8'),
      })
    } catch (error) {
      return Result.err(new AppError(`Failed writing file: ${absolutePath}`, 'FILE_ERROR', error))
    }
  }

  private async fetchWithCache<T>(cacheKey: string, url: string): Promise<T | null> {
    const cachePath = join(this.cdragonCacheDir, `${cacheKey}.json`)
    const cached = await FileManager.readJson<T>(cachePath)
    if (cached.isOk()) return cached.unwrap()
    try {
      const payload = await fetchJson<T>(url, { timeoutMs: 60_000, headers: { 'User-Agent': 'Lelanation/1.0' } })
      await FileManager.writeJson(cachePath, payload)
      return payload
    } catch (error) {
      if (error instanceof HttpRequestError) {
        return null
      }
      return null
    }
  }

  private async fetchTextWithCache(cacheKey: string, url: string): Promise<string | null> {
    const cachePath = join(this.cdragonCacheDir, `${cacheKey}.txt`)
    try {
      const text = await fs.readFile(cachePath, 'utf-8')
      if (text) return text
    } catch {
      // continue
    }
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'Lelanation/1.0' } })
      if (!response.ok) return null
      const text = await response.text()
      await FileManager.ensureDir(this.cdragonCacheDir)
      await fs.writeFile(cachePath, text, 'utf-8')
      return text
    } catch {
      return null
    }
  }

  private async fetchCDragonArtifacts(
    lang: string,
    champions: ChampionRecord[]
  ): Promise<{
    championsByKey: Map<number, CDragonChampion>
    championBinsById: Map<string, ChampionBinJson>
    itemsById: Map<number, CDragonItem>
    perksById: Map<number, CDragonPerk>
    stringTable: StringTableEntries
    hashesText: string
  }> {
    const cdLocale = toCDragonLocale(lang)
    const championsByKey = new Map<number, CDragonChampion>()
    const championBinsById = new Map<string, ChampionBinJson>()
    const itemsById = new Map<number, CDragonItem>()
    const perksById = new Map<number, CDragonPerk>()

    const [itemsPayload, perksPayload, stringTablePayload, hashesText] = await Promise.all([
      this.fetchWithCache<CDragonItem[]>(
        `cdragon-items-${cdLocale}`,
        `${CDRAGON_BASE}/${cdLocale}/v1/items.json`
      ),
      this.fetchWithCache<CDragonPerk[]>(
        `cdragon-perks-${cdLocale}`,
        `${CDRAGON_BASE}/${cdLocale}/v1/perks.json`
      ),
      this.fetchWithCache<{ entries?: StringTableEntries }>(
        `cdragon-stringtable-${toGameDataLocale(lang)}`,
        cdragonStringTableUrl(lang)
      ),
      this.fetchTextWithCache('cdragon-hashes', CDRAGON_HASHES_URL),
    ])

    ;(itemsPayload ?? []).forEach((item) => {
      const id = Number(item.id ?? 0)
      if (id > 0) itemsById.set(id, item)
    })
    ;(perksPayload ?? []).forEach((perk) => {
      const id = Number(perk.id ?? 0)
      if (id > 0) perksById.set(id, perk)
    })

    const championFetches = champions.map(async (champion) => {
      const key = Number(champion.key ?? 0)
      const id = String(champion.id ?? '')
      const payload = await this.fetchWithCache<CDragonChampion>(
        `cdragon-champion-${cdLocale}-${key || id}`,
        `${CDRAGON_BASE}/${cdLocale}/v1/champions/${key}.json`
      )
      const normalizedId = normalizeChampionBinId(id)
      const binPayload = normalizedId
        ? await this.fetchWithCache<ChampionBinJson>(
            `cdragon-bin-${normalizedId}`,
            `https://raw.communitydragon.org/latest/game/data/characters/${normalizedId}/${normalizedId}.bin.json`
          )
        : null
      return { key, payload, normalizedId, binPayload }
    })
    const championData = await Promise.all(championFetches)
    championData.forEach(({ key, payload, normalizedId, binPayload }) => {
      if (payload) championsByKey.set(key, payload)
      if (normalizedId && binPayload) championBinsById.set(normalizedId, binPayload)
    })

    const stringTable = (asObject(stringTablePayload).entries as StringTableEntries | undefined) ?? {}
    return {
      championsByKey,
      championBinsById,
      itemsById,
      perksById,
      stringTable,
      hashesText: hashesText ?? '',
    }
  }

  private buildChampionDetail(args: {
    champion: ChampionRecord
    cdChampion: CDragonChampion | null
    championBin: ChampionBinJson | null
    stringTable: StringTableEntries
    lang: string
  }): Record<string, unknown> {
    const { champion, cdChampion, championBin, stringTable, lang } = args
    const resolvedLang = resolveLang(lang)
    const spellsRaw = Array.isArray(champion.spells) ? (champion.spells as ChampionSpell[]) : []
    const cdSpells = Array.isArray(cdChampion?.spells) ? (cdChampion?.spells as CDragonChampionSpell[]) : []
    const passiveRaw = asObject(champion.passive)
    const cdPassive = asObject(cdChampion?.passive)
    const stats = asObject(champion.stats)
    const championImage = asObject(champion.image)
    const championId = String(champion.id ?? '')
    const championPartype = String(champion.partype ?? '')
    const sharedVars = buildChampionSharedVariableMap(championBin)
    enrichSharedVarsWithSpellDisplayNames(sharedVars, championId, spellsRaw, stringTable)

    let spells: ExportedTheorycraftSpell[] = spellsRaw.map((ddSpell, idx) => {
      const cdSpell = (cdSpells[idx] ?? {}) as CDragonChampionSpell
      const slot = normalizeSpellSlot(idx)
      const binSpell = findBinSpellForDDragon(championBin, [
        String(ddSpell.id ?? ''),
        String((cdSpell as Record<string, unknown>).spellKey ?? ''),
        `${championId}${slot}`,
      ])
      return buildExportedSpell({
        championId,
        slotIndex: idx,
        ddSpell,
        cdSpell,
        binSpell,
        sharedVars,
        stringTable,
        championPartype,
        lang: resolvedLang,
      })
    })

    if (normalizeChampionBinId(championId) === 'aphelios') {
      spells = enrichApheliosSpells(spells, { championBin, stringTable, sharedVars })
    }

    const passiveName = String(passiveRaw.name ?? cdPassive.name ?? '')
    const passiveDetails = (() => {
      const passiveSummary = String(cdPassive.description ?? passiveRaw.description ?? '').trim()
      const passiveBinSpell = findPassiveBinSpell(championBin, championId)
      const passiveDdSpell: ChampionSpell = {
        ...passiveRaw,
        id: `${championId}Passive`,
        maxrank: PASSIVE_CHAMPION_LEVELS.length,
      }
      const passiveContent = resolvePassiveTooltipContent({
        championId,
        passiveBinSpell,
        stringTable,
      })
      let passiveMainRaw = passiveContent.main || passiveSummary
      let passiveTooltip = parseTooltip(
        passiveMainRaw,
        passiveDdSpell,
        cdPassive,
        passiveBinSpell,
        sharedVars,
        { isPassive: true }
      )
      if (isBrokenTooltipText(passiveTooltip.descriptionText) && passiveSummary) {
        passiveMainRaw = passiveSummary
        passiveTooltip = parseTooltip(
          passiveMainRaw,
          passiveDdSpell,
          cdPassive,
          passiveBinSpell,
          sharedVars,
          { isPassive: true }
        )
      }
      const summaryTooltip = passiveSummary
        ? parseTooltip(passiveSummary, passiveDdSpell, cdPassive, passiveBinSpell, sharedVars, {
            isPassive: true,
          })
        : null
      const extendedParsed = passiveContent.extended
        .map((section) =>
          parseTooltip(section, passiveDdSpell, cdPassive, passiveBinSpell, sharedVars, {
            isPassive: true,
          })
        )
        .filter((section) => !isBrokenTooltipText(section.descriptionText))
      const venomDetail =
        passiveContent.main || extendedParsed.length > 0
          ? null
          : passiveBinSpell
            ? buildPassiveVenomDetailFromBin(passiveBinSpell, resolvedLang)
            : null
      const detailedTexts = [
        ...buildUniqueSupplementalSections(
          passiveTooltip.descriptionParsed,
          extendedParsed.map((section) => section.descriptionParsed)
        ),
        ...(venomDetail ? [venomDetail.descriptionHtml] : []),
      ].filter(Boolean)
      const passiveMaxRank = PASSIVE_CHAMPION_LEVELS.length
      const passiveBinDataValues = extractBinDataValues(passiveBinSpell ?? {}, passiveMaxRank)
      const passiveCalculations = extractBinCalculations(
        passiveBinSpell ?? {},
        passiveBinDataValues,
        {
          maxRank: passiveMaxRank,
          isPassive: true,
          ddSpell: passiveDdSpell,
        }
      )
      const passiveSpellEffects = extractSpellEffects(
        passiveDdSpell,
        cdPassive,
        passiveBinSpell
      ).map((effect) => ({
        key: effect.key,
        values: effect.values,
      }))
      return {
        descriptionHtml: passiveTooltip.descriptionParsed,
        descriptionParsed: passiveTooltip.descriptionParsed,
        descriptionText: passiveTooltip.descriptionText,
        parsedText: passiveTooltip.descriptionText,
        tooltipRaw: passiveMainRaw,
        tooltipDetailRaws: passiveContent.extended,
        maxRank: passiveMaxRank,
        calculations: passiveCalculations.map((calculation) => ({
          key: calculation.key,
          baseValues: calculation.baseValues,
          ratios: calculation.ratios,
        })),
        dataValues: passiveBinDataValues.map((entry) => ({
          name: entry.name,
          values: entry.values,
        })),
        spellEffects: passiveSpellEffects,
        ...(summaryTooltip
          ? {
              summaryHtml: summaryTooltip.descriptionParsed,
              summaryText: summaryTooltip.descriptionText,
            }
          : {}),
        ...(detailedTexts.length > 0
          ? {
              detailedTexts,
              detailedText: detailedTexts
                .map((section) => normalizeTooltipPlainText(section))
                .join('\n\n'),
            }
          : {}),
      }
    })()

    const passive = {
      name: passiveName,
      image: {
        full: String(asObject(passiveRaw.image).full ?? `${championId}_Passive.png`),
      },
      ...passiveDetails,
    }

    const stackDefinitions = [
      extractStackDefinition({
        id: 'passive',
        label: passiveName,
        scope: 'passive',
        calculations: passive.calculations as ExportedStackCalculation[],
        dataValues: (passive.dataValues as Array<{ name: string; values: number[] }>) ?? [],
      }),
      ...spells.flatMap((spell) => {
        const definition = extractStackDefinition({
          id: String(spell.id ?? ''),
          label: String(spell.name ?? ''),
          scope: 'spell',
          spellSlot: String(spell.slot ?? ''),
          calculations: (spell.calculations as ExportedStackCalculation[]) ?? [],
          dataValues: (spell.dataValues as Array<{ name: string; values: number[] }>) ?? [],
        })
        return definition ? [definition] : []
      }),
    ].filter((entry): entry is ExportedStackDefinition => entry != null)

    return {
      id: String(champion.id ?? ''),
      key: Number(champion.key ?? 0),
      name: String(champion.name ?? ''),
      title: String(champion.title ?? ''),
      partype: championPartype,
      image: {
        full: String(championImage.full ?? `${championId}.png`),
      },
      baseStats: {
        hp: Number(stats.hp ?? 0),
        hpRegen: Number(stats.hpregen ?? 0),
        mp: Number(stats.mp ?? 0),
        mpRegen: Number(stats.mpregen ?? 0),
        armor: Number(stats.armor ?? 0),
        magicResist: Number(stats.spellblock ?? 0),
        attackDamage: Number(stats.attackdamage ?? 0),
        attackSpeed: Number(stats.attackspeed ?? 0),
        attackRange: Number(stats.attackrange ?? 0),
        movespeed: Number(stats.movespeed ?? 0),
      },
      growthStats: {
        hp: Number(stats.hpperlevel ?? 0),
        hpRegen: Number(stats.hpregenperlevel ?? 0),
        mp: Number(stats.mpperlevel ?? 0),
        mpRegen: Number(stats.mpregenperlevel ?? 0),
        armor: Number(stats.armorperlevel ?? 0),
        magicResist: Number(stats.spellblockperlevel ?? 0),
        attackDamage: Number(stats.attackdamageperlevel ?? 0),
        attackSpeed: Number(stats.attackspeedperlevel ?? 0),
      },
      passive,
      spells,
      stackDefinitions,
    }
  }

  async build(version: string): Promise<Result<{ champions: number }, AppError>> {
    try {
      const generatedAt = new Date().toISOString()
      await FileManager.ensureDir(this.cdragonCacheDir)
      await fs.rm(join(this.frontendDataDir, 'champions'), { recursive: true, force: true }).catch(() => undefined)
      await fs.rm(join(this.frontendDataDir, 'manifest.json'), { force: true }).catch(() => undefined)

      const manifestEntries: Array<{ path: string; sha256: string; bytes: number }> = []
      let championsCount = 0

      for (const lang of SUPPORTED_LANGS) {
        const championFullRes = await this.readChampionFull(version, lang)
        if (championFullRes.isErr()) return Result.err(championFullRes.unwrapErr())

        const champions = Object.values(championFullRes.unwrap().data ?? {})
        const cdragon = await this.fetchCDragonArtifacts(lang, champions)

        championsCount = Math.max(championsCount, champions.length)
        const index = champions.map(toChampionIndexEntry)
        const indexPayload = {
          schemaVersion: SCHEMA_VERSION,
          dataVersion: version,
          generatedAt,
          champions: index,
        }
        const langChampionsDir = join(this.frontendGameDir, version, lang, 'champions')
        await FileManager.ensureDir(langChampionsDir)
        const indexWrite = await this.writeJsonWithHash(join(langChampionsDir, 'index.json'), indexPayload)
        if (indexWrite.isErr()) return Result.err(indexWrite.unwrapErr())
        manifestEntries.push({
          path: indexWrite.unwrap().relativePath,
          sha256: indexWrite.unwrap().sha256,
          bytes: indexWrite.unwrap().bytes,
        })
        const liveChampionFiles = new Set<string>()
        for (const champion of champions) {
          const id = String(champion.id ?? '').toLowerCase()
          if (!id) continue
          const champKey = Number(champion.key ?? 0)
          const cdChampion = cdragon.championsByKey.get(champKey) ?? null
          const championBin = cdragon.championBinsById.get(normalizeChampionBinId(String(champion.id ?? ''))) ?? null
          const championPayload = {
            schemaVersion: SCHEMA_VERSION,
            dataVersion: version,
            generatedAt,
            champion: this.buildChampionDetail({
              champion,
              cdChampion,
              championBin,
              stringTable: cdragon.stringTable,
              lang,
            }),
          }
          const target = join(langChampionsDir, `${id}.json`)
          liveChampionFiles.add(`${id}.json`)
          const wrote = await this.writeJsonWithHash(target, championPayload)
          if (wrote.isErr()) return Result.err(wrote.unwrapErr())
          manifestEntries.push({
            path: wrote.unwrap().relativePath,
            sha256: wrote.unwrap().sha256,
            bytes: wrote.unwrap().bytes,
          })
        }

        const preservedChampionFiles = new Set(['index.json'])
        const staleFiles = await fs.readdir(langChampionsDir).catch(() => [])
        await Promise.all(
          staleFiles
            .filter(
              (file) =>
                file.endsWith('.json') &&
                !liveChampionFiles.has(file) &&
                !preservedChampionFiles.has(file)
            )
            .map((file) => fs.rm(join(langChampionsDir, file), { force: true }))
        )

      }

      const versionsWrite = await this.writeJsonWithHash(join(this.frontendGameDir, 'versions.json'), {
        currentVersion: version,
        version,
        langs: [...SUPPORTED_LANGS],
        schemaVersion: SCHEMA_VERSION,
        generatedAt,
      })
      if (versionsWrite.isErr()) return Result.err(versionsWrite.unwrapErr())
      manifestEntries.push({
        path: versionsWrite.unwrap().relativePath,
        sha256: versionsWrite.unwrap().sha256,
        bytes: versionsWrite.unwrap().bytes,
      })
      await fs.rm(join(this.frontendDataDir, 'versions.json'), { force: true }).catch(() => undefined)

      const manifest = {
        schemaVersion: SCHEMA_VERSION,
        dataVersion: version,
        generatedAt,
        files: manifestEntries.sort((a, b) => a.path.localeCompare(b.path)),
        hash: toSha256(stableStringify(manifestEntries)),
      }
      const manifestWrite = await this.writeJsonWithHash(join(this.frontendGameDir, version, 'manifest.json'), manifest)
      if (manifestWrite.isErr()) return Result.err(manifestWrite.unwrapErr())

      await this.removeLegacyFrontendChampionExports(version)

      return Result.ok({ champions: championsCount })
    } catch (error) {
      return Result.err(new AppError('Failed to build theorycraft data', 'FILE_ERROR', error))
    }
  }
}

export const theorycraftTooltipTestUtils = {
  formatValueSeries,
  trimByMaxRank,
  extractBinDataValues,
  extractBinCalculations,
  extractSpellRatios,
  normalizeRiotInlineIconTokens,
  findPassiveBinSpell,
  resolvePassiveTooltipContent,
  resolveSpellTooltipContent,
  lookupStringTableEntry,
  buildChampionSharedVariableMap,
  buildPassiveVenomDetailFromBin,
  parseTooltip,
  findBinSpellForDDragon,
  inferSpellSlotIndex,
  interpolateByCharLevel,
  championLevelForAbilityRank,
  buildExportedSpell,
  extractStackDefinition,
}
