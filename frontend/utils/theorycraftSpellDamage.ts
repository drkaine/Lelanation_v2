/**
 * Spell damage read from the tooltip markup: damage tags give the parts that hit a champion,
 * their type and their health scaling (flat, % max / missing / current health).
 */
import { emptySplit, type DamageSplit, type DamageType } from './theorycraftPracticeTool'

export type HpScaling = 'flat' | 'maxHp' | 'missingHp' | 'currentHp'

export interface TooltipDamagePart {
  key: string
  type: DamageType
  scaling: HpScaling
  /** Placeholder written `{{ key*100 }}`: the value is already a fraction. */
  fraction: boolean
}

interface SpellRatio {
  stat?: unknown
  coefficient?: number[] | number
  type?: unknown
}

export interface SpellDamageSource {
  calculations?: Array<{
    key?: unknown
    baseValues?: number[]
    ratios?: SpellRatio[]
    displayAsPercent?: boolean
  }>
  dataValues?: Array<{ name?: unknown; values?: number[] }>
}

export type DamageProfile = Record<HpScaling, DamageSplit>

const TAG_TYPES: Record<string, DamageType> = {
  physicaldamage: 'physical',
  magicdamage: 'magic',
  truedamage: 'true',
}
const NON_CHAMPION_KEY = /monster|minion|structure|turret|tower/i
const ALTERNATIVE_BEFORE = /(increased to|up to|instead|jusqu'à|augmentés? à|à la place)\s*$/i
/** Wording between two tags of the same damage that marks a second hit (delayed hit, recast). */
const REPEAT_HIT =
  /additional|again|second|recast|reactivat|bonus|supplémentaires?|de nouveau|à nouveau|relanc|réactiv|disparaît|prend fin|expire/i

function scalingOf(text: string): HpScaling {
  const normalized = text.toLowerCase()
  if (/missing\s+health|pv\s+manquants/.test(normalized)) return 'missingHp'
  if (/current\s+health|pv\s+actuels/.test(normalized)) return 'currentHp'
  if (/max(imum)?\s+health|pv\s+max|santé\s+max/.test(normalized)) return 'maxHp'
  return 'flat'
}

export function parseTooltipDamageParts(
  tooltipRaw: string | null | undefined
): TooltipDamagePart[] {
  const text = String(tooltipRaw ?? '')
  const parts: TooltipDamagePart[] = []
  /** End of the last tag that held each part, to read the wording up to a repeat. */
  const lastEnd = new Map<string, number>()
  const tagPattern = /<(physicalDamage|magicDamage|trueDamage)>([\s\S]*?)<\/\1>/gi
  for (const tag of text.matchAll(tagPattern)) {
    const tagEnd = (tag.index ?? 0) + tag[0].length
    const before = text.slice(Math.max(0, (tag.index ?? 0) - 40), tag.index ?? 0)
    if (ALTERNATIVE_BEFORE.test(before)) continue
    const type = TAG_TYPES[tag[1]!.toLowerCase()]!
    const body = tag[2]!
    const placeholders = [...body.matchAll(/\{\{\s*([\w.]+)\s*(\*\s*100)?\s*\}\}/g)]
    placeholders.forEach((placeholder, index) => {
      const key = placeholder[1]!.toLowerCase()
      if (NON_CHAMPION_KEY.test(key)) return
      const end = placeholders[index + 1]?.index ?? body.length
      const after = body.slice((placeholder.index ?? 0) + placeholder[0].length, end)
      const scaling = scalingOf(after)
      const id = `${key}|${type}|${scaling}`
      const previousEnd = lastEnd.get(id)
      // Same damage again: counted only when worded as a second hit, after this tag too
      // (French puts « supplémentaires » after the damage).
      if (previousEnd !== undefined && !REPEAT_HIT.test(text.slice(previousEnd, tagEnd + 20)))
        return
      lastEnd.set(id, tagEnd)
      parts.push({ key, type, scaling, fraction: Boolean(placeholder[2]) })
    })
  }
  return parts
}

function atRank(values: number[] | number | undefined, rankIndex: number): number {
  if (Array.isArray(values)) {
    if (values.length === 0) return 0
    const value = Number(values[Math.min(Math.max(rankIndex, 0), values.length - 1)])
    return Number.isFinite(value) ? value : 0
  }
  const value = Number(values ?? 0)
  return Number.isFinite(value) ? value : 0
}

function lower(value: unknown): string {
  return String(value ?? '').toLowerCase()
}

/** Raw value of a calculation or dataValue, null when the key is unknown. */
function resolveKeyValue(
  source: SpellDamageSource,
  key: string,
  rankIndex: number,
  statValue: (stat: string) => number,
  statAlias: Record<string, string> = {}
): { value: number; percent: boolean } | null {
  const calc = (source.calculations ?? []).find(entry => lower(entry.key) === key)
  if (calc) {
    let value = atRank(calc.baseValues, rankIndex)
    for (const ratio of calc.ratios ?? []) {
      const stat = String(ratio.stat ?? '')
      value += atRank(ratio.coefficient, rankIndex) * statValue(statAlias[stat] ?? stat)
    }
    return { value, percent: Boolean(calc.displayAsPercent) }
  }
  const data = (source.dataValues ?? []).find(entry => lower(entry.name) === key)
  if (data) return { value: atRank(data.values, rankIndex), percent: false }
  return null
}

function toFraction(value: number, percent: boolean, fraction: boolean): number {
  if (fraction) return value
  if (percent || value > 1) return value / 100
  return value
}

export function resolveDamageProfile(
  source: SpellDamageSource,
  parts: TooltipDamagePart[],
  rankIndex: number,
  statValue: (stat: string) => number
): DamageProfile {
  const profile: DamageProfile = {
    flat: emptySplit(),
    maxHp: emptySplit(),
    missingHp: emptySplit(),
    currentHp: emptySplit(),
  }
  for (const part of parts) {
    const resolved = resolveKeyValue(source, part.key, rankIndex, statValue)
    if (!resolved) continue
    const amount =
      part.scaling === 'flat'
        ? resolved.value
        : toFraction(resolved.value, resolved.percent, part.fraction)
    profile[part.scaling][part.type] += Math.max(0, amount)
  }
  return profile
}

export function profileHasDamage(profile: DamageProfile): boolean {
  return Object.values(profile).some(split => split.physical + split.magic + split.true > 0)
}

/** Raw (unmitigated) damage of a profile against a target at the given health. */
export function evaluateDamageProfile(
  profile: DamageProfile,
  target: { maxHp: number; currentHp: number }
): DamageSplit {
  const maxHp = Math.max(0, Number(target.maxHp) || 0)
  const currentHp = Math.min(maxHp, Math.max(0, Number(target.currentHp) || 0))
  const result = emptySplit()
  for (const type of ['physical', 'magic', 'true'] as const) {
    result[type] =
      profile.flat[type] +
      profile.maxHp[type] * maxHp +
      profile.missingHp[type] * (maxHp - currentHp) +
      profile.currentHp[type] * currentHp
  }
  return result
}

interface ExecuteRule {
  key: string
  kind: 'percentMaxHp' | 'flat'
  statAlias?: Record<string, string>
}

/** Spells that kill outright under a health threshold (key = champion id + slot). */
const EXECUTE_RULES: Record<string, ExecuteRule> = {
  urgotr: { key: 'rhealththreshold', kind: 'percentMaxHp' },
  // The data labels Pyke's lethality ratio as AP.
  pyker: { key: 'rdamage', kind: 'flat', statAlias: { AP: 'lethality' } },
  aurelionsole: { key: 'currentexecutionthreshold', kind: 'percentMaxHp' },
}

/** Health under which the spell executes the target, or null. */
export function resolveExecuteThreshold(
  championId: string,
  slot: string,
  source: SpellDamageSource,
  rankIndex: number,
  statValue: (stat: string) => number,
  targetMaxHp: number
): number | null {
  const rule = EXECUTE_RULES[`${lower(championId)}${lower(slot)}`]
  if (!rule) return null
  const resolved = resolveKeyValue(source, rule.key, rankIndex, statValue, rule.statAlias)
  if (!resolved || resolved.value <= 0) return null
  if (rule.kind === 'flat') return resolved.value
  return toFraction(resolved.value, true, false) * Math.max(0, targetMaxHp)
}

type HeaderStats = Array<{ key?: unknown; valueText?: unknown }> | null | undefined

/** Number of a "a / b / c" header text at a rank (1-based), null when the text has none. */
function headerNumberAtRank(text: string, rank: number): number | null {
  const values = [...text.matchAll(/\d+(?:[.,]\d+)?/g)]
    .map(match => Number(match[0].replace(',', '.')))
    .filter(Number.isFinite)
  if (values.length === 0) return null
  return values[Math.min(Math.max(rank - 1, 0), values.length - 1)]!
}

/** Resource cost shown in the spell header ("55 / 65 / 75 Mana") at a rank (1-based). */
export function headerCostAtRank(headerStats: HeaderStats, rank: number): number {
  const cost = (headerStats ?? []).find(stat => lower(stat.key) === 'cost')
  if (!cost) return 0
  const text = String(cost.valueText ?? '')
  if (/health|santé|\bpv\b/i.test(text)) return 0
  return headerNumberAtRank(text, rank) ?? 0
}

/** Cooldown shown in the spell header at a rank (1-based), null without a cooldown entry. */
export function headerCooldownAtRank(headerStats: HeaderStats, rank: number): number | null {
  const cooldown = (headerStats ?? []).find(stat => lower(stat.key) === 'cooldown')
  if (!cooldown) return null
  return headerNumberAtRank(String(cooldown.valueText ?? ''), rank)
}

/** Cooldown after reduction (fraction from the build stats, capped at 99%). */
export function cooldownAfterReduction(cooldown: number, reduction: number): number {
  return cooldown * (1 - Math.min(0.99, Math.max(0, reduction)))
}

/** Duration this long or more means "lasts until toggled off". */
const TOGGLE_DURATION = 1000

export interface SustainedFire {
  shotsPerSecond: number
  duration: number
  toggle: boolean
  /** Share of on-hit damage applied by each shot. */
  onHitRatio: number
}

/** Spells firing repeatedly while active (Urgot W): shots per second, duration, toggle. */
export function resolveSustainedFire(
  source: SpellDamageSource,
  rankIndex: number
): SustainedFire | null {
  const values = source.dataValues ?? []
  const rate = values.find(entry => /(attacks|shots)persecond$/.test(lower(entry.name)))
  const duration = values.find(entry => lower(entry.name) === 'duration')
  if (!rate || !duration) return null
  const shotsPerSecond = atRank(rate.values, rankIndex)
  const seconds = atRank(duration.values, rankIndex)
  if (!(shotsPerSecond > 0) || !(seconds > 0)) return null
  const toggle = seconds >= TOGGLE_DURATION
  const onHit = values.find(entry => lower(entry.name) === 'onhitdamagereduction')
  const onHitRatio = onHit ? atRank(onHit.values, rankIndex) : 1
  return { shotsPerSecond, duration: toggle ? Infinity : seconds, toggle, onHitRatio }
}

/** Passives fired by attacks or by some spells (curated). */
const PASSIVE_TRIGGERS: Record<string, { attacks: boolean; spellSlots: string[] }> = {
  urgot: { attacks: true, spellSlots: ['W'] },
}

export function passiveTriggers(
  championId: string
): { attacks: boolean; spellSlots: string[] } | null {
  return PASSIVE_TRIGGERS[lower(championId)] ?? null
}

/** Self heal and shield written in the tooltip (`<healing>` / `<shield>` tags). */
export function resolveSpellSustain(
  source: SpellDamageSource & { tooltipRaw?: unknown },
  rankIndex: number,
  statValue: (stat: string) => number
): { heal: number; shield: number } {
  const text = String(source.tooltipRaw ?? '')
  const result = { heal: 0, shield: 0 }
  const seen = new Set<string>()
  for (const tag of text.matchAll(/<(healing|shield)>([\s\S]*?)<\/\1>/gi)) {
    const body = tag[2]!
    if (/max(imum)?\s+health|pv\s+max|santé\s+max|regen|régén/i.test(body)) continue
    const kind = tag[1]!.toLowerCase() === 'healing' ? 'heal' : 'shield'
    for (const placeholder of body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
      const key = placeholder[1]!.toLowerCase()
      if (NON_CHAMPION_KEY.test(key) || seen.has(`${kind}|${key}`)) continue
      seen.add(`${kind}|${key}`)
      const resolved = resolveKeyValue(source, key, rankIndex, statValue)
      if (resolved) result[kind] += Math.max(0, resolved.value)
    }
  }
  return result
}
