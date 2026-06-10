import { formatTooltipMarkupHtml } from './formatTooltipMarkupHtml'
import {
  filterKaynDetailedTexts,
  filterKaynTooltipHtml,
  normalizeKaynFormMarkup,
  type KaynFormFilter,
} from './kaynFormTooltipMarkup'
import { resolveSummonerSpellTooltipText } from './resolveSummonerSpellTooltip'

export type SpellHeaderStat = {
  key: string
  label: string
  valueText: string
  valueHtml?: string
}

type SpellLike = {
  key?: string
  description?: string
  descriptionHtml?: string
  descriptionParsed?: string
  descriptionText?: string
  parsedText?: string
  tooltip?: string
  detailedTexts?: string[]
  headerStats?: SpellHeaderStat[]
  costBurn?: string
  cooldownBurn?: string
  rangeBurn?: string
  costType?: string
  effect?: Array<number[] | null>
  datavalues?: Record<string, unknown>
}

export type FormatSpellTooltipOptions = {
  /** @deprecated use showHeaderStats */
  showCost?: boolean
  showHeaderStats?: boolean
  /** Form variants (Kayn blue/red, etc.) from detailedTexts. Default: true */
  showDetailedTexts?: boolean
  /** Summoner spell: no cost in meta, use DDragon description instead of tooltip templates */
  summoner?: boolean
  /** Builder Kayn : n'afficher que les blocs Darkin (1) ou Assassin (2). */
  kaynForm?: KaynFormFilter
}

function escapeTooltipText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const EMPTY_CAST_TIME_VALUES = new Set([
  '',
  'aucune',
  'aucun',
  'none',
  '0',
  '0 sec',
  '0s',
  'instant',
  'instantanée',
  'instantané',
])

/** "9/8.5/8" → "9 / 8.5 / 8" for readable tooltips. */
export function formatRankSeriesText(text: string): string {
  return String(text ?? '')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function formatHeaderStatDisplayValue(stat: SpellHeaderStat): string {
  const formattedText = formatRankSeriesText(stat.valueText)
  if (stat.valueHtml && stat.valueHtml !== stat.valueText) {
    return formatRankSeriesInHtml(stat.valueHtml)
  }
  return escapeTooltipText(formattedText)
}

function formatRankSeriesInHtml(html: string): string {
  return String(html ?? '').replace(/(?<=[\d%.,])\s*\/\s*(?=[\d%.,])/g, ' / ')
}

function shouldShowHeaderStat(stat: SpellHeaderStat, options?: { summoner?: boolean }): boolean {
  const raw = String(stat.valueText ?? '').trim()
  if (!raw && !String(stat.valueHtml ?? '').trim()) return false

  if (stat.key === 'cost' && options?.summoner) return false

  if (stat.key === 'cost') {
    const normalized = raw.toLowerCase().replace(/\s+/g, ' ')
    if (/^0(\s|$)/.test(normalized)) return false
    if (
      normalized.includes('pas de coût') ||
      normalized.includes('no cost') ||
      normalized.includes('sans coût')
    ) {
      return false
    }
  }

  if (stat.key === 'castTime') {
    const normalized = raw.toLowerCase().replace(/\s+/g, ' ')
    if (EMPTY_CAST_TIME_VALUES.has(normalized)) return false
  }

  return true
}

export function formatSpellHeaderStatsHtml(
  headerStats: SpellHeaderStat[],
  options?: { summoner?: boolean }
): string {
  const lines = headerStats
    .filter(stat => shouldShowHeaderStat(stat, options))
    .map(stat => {
      const value = formatHeaderStatDisplayValue(stat)
      return `<div class="tooltip-spell-meta-line"><span class="tooltip-spell-meta-key">${escapeTooltipText(stat.label)}:</span> <span class="tooltip-spell-meta-value">${value}</span></div>`
    })

  if (lines.length === 0) return ''
  return `<div class="tooltip-spell-meta">${lines.join('')}</div>`
}

function isSummonerSpell(spell: SpellLike): boolean {
  return (
    !Array.isArray(spell.headerStats) &&
    (Boolean(spell.cooldownBurn) || Boolean(spell.costBurn) || Boolean(spell.rangeBurn))
  )
}

function buildSummonerSpellHeaderStats(spell: SpellLike): SpellHeaderStat[] {
  const stats: SpellHeaderStat[] = []
  const cooldown = String(spell.cooldownBurn ?? '').trim()
  if (cooldown) {
    stats.push({
      key: 'cooldown',
      label: 'DÉLAI DE RÉCUPÉRATION',
      valueText: formatRankSeriesText(cooldown),
    })
  }
  const range = String(spell.rangeBurn ?? '').trim()
  if (range && range !== '0') {
    stats.push({ key: 'range', label: 'PORTÉE', valueText: formatRankSeriesText(range) })
  }
  return stats
}

/** Resolve summoner tooltip (prefers rich tooltip over generic description since patch ~16). */
function resolveSummonerSpellBody(spell: SpellLike): string {
  return resolveSummonerSpellTooltipText(spell)
}

function resolveSpellHeaderStats(
  spell: SpellLike,
  options?: FormatSpellTooltipOptions
): SpellHeaderStat[] {
  if (Array.isArray(spell.headerStats) && spell.headerStats.length > 0) {
    return spell.headerStats
  }
  if (isSummonerSpell(spell) || options?.summoner) {
    return buildSummonerSpellHeaderStats(spell)
  }
  return []
}

function shouldShowHeaderStats(spell: SpellLike, options?: FormatSpellTooltipOptions): boolean {
  if (options?.showHeaderStats != null) return options.showHeaderStats
  if (options?.showCost === false) return false
  return resolveSpellHeaderStats(spell, options).length > 0
}

export function formatSpellDetailedTextsHtml(
  spell: SpellLike,
  options?: FormatSpellTooltipOptions
): string {
  if (options?.showDetailedTexts === false) return ''
  const rawSections = Array.isArray(spell.detailedTexts)
    ? spell.detailedTexts
        .map(section => String(section ?? '').trim())
        .filter(section => section.length > 0)
    : []
  const filteredSections = options?.kaynForm
    ? filterKaynDetailedTexts(rawSections, options.kaynForm)
    : rawSections
  const sections = filteredSections.map(section => formatPreParsedTooltipSection(section))
  if (sections.length === 0) return ''
  return sections.map(section => `<div class="tooltip-spell-detail">${section}</div>`).join('')
}

const PRE_PARSED_TOOLTIP_MARKUP_RE =
  /class=["'][^"']*(?:dmg-(?:physical|magic|true)|tooltip-icon|tooltip-tag|status-cc|scale-(?:ad|ap|mana|hp|level|mr)|keyword|healing|shield|speed)/i

function hasKaynFormMarkup(html: string): boolean {
  return /kayn-form-(?:darkin|shadow)|#fe5c50|#8484fb/i.test(html)
}

function resolveNonSummonerSpellBodyHtml(spell: SpellLike): string {
  const preParsed = String(spell.descriptionHtml ?? spell.descriptionParsed ?? '').trim()
  const fallback = String(
    spell.description ?? spell.descriptionText ?? spell.parsedText ?? spell.tooltip ?? ''
  ).trim()
  const raw = preParsed || fallback
  if (!raw) return ''

  const usePreParsedAsHtml =
    Boolean(preParsed) &&
    (PRE_PARSED_TOOLTIP_MARKUP_RE.test(preParsed) || hasKaynFormMarkup(preParsed))

  if (usePreParsedAsHtml) return preParsed

  const tooltipRaw = String(spell.tooltip ?? '').trim()
  if (hasKaynFormMarkup(tooltipRaw)) {
    return formatTooltipMarkupHtml(tooltipRaw).replace(/\n/g, '<br>')
  }

  return formatTooltipMarkupHtml(raw).replace(/\n/g, '<br>')
}

/** Rich HTML from theorycraft JSON (descriptionHtml / descriptionParsed). */
export function resolveSpellTooltipBodyHtml(
  spell: SpellLike,
  options?: FormatSpellTooltipOptions
): string {
  const summoner = options?.summoner ?? isSummonerSpell(spell)
  if (summoner) {
    const raw = resolveSummonerSpellBody(spell)
    return raw ? formatTooltipMarkupHtml(raw).replace(/\n/g, '<br>') : ''
  }

  let html = normalizeKaynFormMarkup(resolveNonSummonerSpellBodyHtml(spell))
  if (!html) return ''

  if (options?.kaynForm) {
    html = filterKaynTooltipHtml(html, options.kaynForm)
  }

  return html
}

function formatPreParsedTooltipSection(section: string): string {
  const trimmed = String(section ?? '').trim()
  if (!trimmed) return ''
  if (PRE_PARSED_TOOLTIP_MARKUP_RE.test(trimmed)) {
    return normalizeKaynFormMarkup(trimmed)
  }
  return normalizeKaynFormMarkup(formatTooltipMarkupHtml(trimmed).replace(/\n/g, '<br>'))
}

export function formatSummonerSpellTooltipHtml(
  spell: SpellLike,
  options?: FormatSpellTooltipOptions
): string {
  return formatSpellTooltipHtml(spell, { ...options, summoner: true, showDetailedTexts: false })
}

export function formatSpellTooltipHtml(
  spell: SpellLike,
  options?: FormatSpellTooltipOptions
): string {
  const summoner = options?.summoner ?? isSummonerSpell(spell)
  const metaHtml = shouldShowHeaderStats(spell, options)
    ? formatSpellHeaderStatsHtml(resolveSpellHeaderStats(spell, options), {
        summoner: summoner || undefined,
      })
    : ''

  const bodyHtml = resolveSpellTooltipBodyHtml(spell, options)
  const detailHtml = formatSpellDetailedTextsHtml(spell, options)

  return [metaHtml, bodyHtml, detailHtml].filter(Boolean).join('<br>')
}
