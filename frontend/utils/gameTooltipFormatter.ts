import { formatTooltipMarkupHtml } from './formatTooltipMarkupHtml'

export type SpellHeaderStat = {
  key: string
  label: string
  valueText: string
  valueHtml?: string
}

type SpellLike = {
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
}

export type FormatSpellTooltipOptions = {
  /** @deprecated use showHeaderStats */
  showCost?: boolean
  showHeaderStats?: boolean
  /** Form variants (Kayn blue/red, etc.) from detailedTexts. Default: true */
  showDetailedTexts?: boolean
  /** Summoner spell: no cost in meta, use DDragon description instead of tooltip templates */
  summoner?: boolean
}

function escapeTooltipText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatSpellHeaderStatsHtml(headerStats: SpellHeaderStat[]): string {
  const lines = headerStats
    .filter(stat => String(stat.valueHtml ?? stat.valueText ?? '').trim().length > 0)
    .map(stat => {
      const value = stat.valueHtml ?? escapeTooltipText(stat.valueText)
      return `<span class="tooltip-spell-meta-line"><span class="tooltip-spell-meta-key">${escapeTooltipText(stat.label)}:</span> ${value}</span>`
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
      valueText: cooldown,
    })
  }
  const range = String(spell.rangeBurn ?? '').trim()
  if (range && range !== '0') {
    stats.push({ key: 'range', label: 'PORTÉE', valueText: range })
  }
  return stats
}

/** DDragon description is plain text; tooltip often has unresolved {{ vars }}. */
function resolveSummonerSpellBody(spell: SpellLike): string {
  const description = String(spell.description ?? '').trim()
  const tooltip = String(spell.tooltip ?? '').trim()

  if (description && !/\{\{[^}]+\}\}/.test(description)) {
    return description
  }
  if (tooltip && !/\{\{[^}]+\}\}/.test(tooltip)) {
    return tooltip
  }
  if (description) return description

  return tooltip
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
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

function formatSpellDetailedTextsHtml(
  spell: SpellLike,
  options?: FormatSpellTooltipOptions
): string {
  if (options?.showDetailedTexts === false) return ''
  const sections = Array.isArray(spell.detailedTexts)
    ? spell.detailedTexts
        .map(section => String(section ?? '').trim())
        .filter(section => section.length > 0)
        .map(section => formatTooltipMarkupHtml(section).replace(/\n/g, '<br>'))
    : []
  if (sections.length === 0) return ''
  return sections.map(section => `<div class="tooltip-spell-detail">${section}</div>`).join('')
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
    ? formatSpellHeaderStatsHtml(resolveSpellHeaderStats(spell, options))
    : ''

  const raw = summoner
    ? resolveSummonerSpellBody(spell)
    : String(
        spell.descriptionHtml ??
          spell.descriptionParsed ??
          spell.description ??
          spell.descriptionText ??
          spell.parsedText ??
          spell.tooltip ??
          ''
      )
  const bodyHtml = raw ? formatTooltipMarkupHtml(raw).replace(/\n/g, '<br>') : ''
  const detailHtml = formatSpellDetailedTextsHtml(spell, options)

  return [metaHtml, bodyHtml, detailHtml].filter(Boolean).join('<br><br>')
}
