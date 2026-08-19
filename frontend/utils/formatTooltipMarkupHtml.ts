const STRIP_WRAPPER_TAGS = ['mainText', 'rules', 'section', 'ornnBonus', 'stats']

const PRESERVE_HTML_TAGS = new Set([
  'br',
  'b',
  'i',
  'u',
  'font',
  'li',
  'hr',
  'tr',
  'td',
  'th',
  'table',
  'thead',
  'tbody',
  'span',
  'div',
])

/** Riot Data Dragon semantic tags → CSS classes used by tooltip-game-description. */
const RIOT_TAG_TO_CLASS: Record<string, string> = {
  physicaldamage: 'dmg-physical',
  magicdamage: 'dmg-magic',
  truedamage: 'dmg-true',
  healing: 'healing',
  shield: 'shield',
  speed: 'speed',
  attackspeed: 'tooltip-tag-attackspeed',
  gold: 'gold',
  keywordmajor: 'keyword-major',
  keywordstealth: 'keyword-stealth',
  keyword: 'keyword',
  status: 'status-cc',
  scalead: 'scale-ad',
  scaleap: 'scale-ap',
  scalearmor: 'scale-armor',
  scalemr: 'scale-mr',
  scalemana: 'scale-mana',
  scalehealth: 'scale-hp',
  scalelevel: 'scale-level',
  attention: 'attention',
  statgood: 'stat-good',
  spellname: 'spell-name',
  spellactive: 'active',
  spellpassive: 'passive',
  onhit: 'on-hit',
  recast: 'recast',
  raritygeneric: 'rarity-generic',
  raritylegendary: 'rarity-legendary',
  raritymythic: 'rarity-mythic',
  unique: 'unique',
}

function convertRiotSemanticTags(html: string): string {
  return html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\s*>/g, (match, slash, tag) => {
    const lower = tag.toLowerCase()
    if (PRESERVE_HTML_TAGS.has(lower)) return match
    if (STRIP_WRAPPER_TAGS.includes(lower)) return match
    const className = RIOT_TAG_TO_CLASS[lower]
    if (!className) return match
    const scaleClasses = new Set([
      'scale-ad',
      'scale-ap',
      'scale-armor',
      'scale-mr',
      'scale-mana',
      'scale-hp',
      'scale-level',
    ])
    const classes = scaleClasses.has(className) ? `tooltip-tag ${className}` : className
    return slash ? '</span>' : `<span class="${classes}">`
  })
}

const ADAPTIVE_FONT_COLORS = new Set(['#48c4b7'])

function escapeTooltipPlainText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapTooltipSpan(className: string, inner: string): string {
  return `<span class="${className}">${inner}</span>`
}

function normalizeAdaptiveKeywordTags(html: string): string {
  return html.replace(
    /<\s*lol-uikit-tooltipped-keyword[^>]*key=['"][^'"]*Adaptive[^'"]*['"][^>]*>([\s\S]*?)<\s*\/\s*lol-uikit-tooltipped-keyword\s*>/gi,
    (_match, inner: string) => wrapTooltipSpan('stat-adaptive', inner)
  )
}

function normalizeFontColorTags(html: string): string {
  return html.replace(
    /<\s*font\s+color=['"]([^'"]+)['"]\s*>([\s\S]*?)<\s*\/\s*font\s*>/gi,
    (_match, color: string, inner: string) => {
      if (ADAPTIVE_FONT_COLORS.has(color.trim().toLowerCase())) {
        return wrapTooltipSpan('stat-adaptive', inner)
      }
      return inner
    }
  )
}

function normalizeRiotInlineIconTokens(html: string): string {
  let text = html
  text = text.replace(/\s*\(%i:scalearmor%\{\{\s*f1\s*\}\}\)/gi, '')
  text = text.replace(/\s*\(%i:scalearmor%\{\{\s*f2\s*\}\}\)/gi, '')
  text = text.replace(/%i:([a-zA-Z][a-zA-Z0-9]*)%\s*(<\s*\1\b)/gi, '$1')
  text = text.replace(/%i:([a-zA-Z][a-zA-Z0-9]*)%/gi, (_match, tag: string) => {
    const className = RIOT_TAG_TO_CLASS[tag.toLowerCase()]
    if (!className) return ''
    return `<span class="tooltip-tag ${className}"></span>`
  })
  return text
}

export function formatTooltipMarkupHtml(raw: string | null | undefined): string {
  if (!raw) return ''
  let html = normalizeRiotInlineIconTokens(String(raw))

  html = normalizeAdaptiveKeywordTags(html)
  html = normalizeFontColorTags(html)

  // LoL UI wrapper tags often wrap useful text; keep text, drop wrapper.
  html = html.replace(
    /<\s*lol-uikit-tooltipped-keyword[^>]*>([\s\S]*?)<\s*\/\s*lol-uikit-tooltipped-keyword\s*>/gi,
    '$1'
  )

  html = convertRiotSemanticTags(html)

  // Convert list-ish inline markers into readable bullets.
  html = html.replace(/<\s*li\s*>/gi, '<br>• ')
  html = html.replace(/<\s*\/\s*li\s*>/gi, '')
  html = html.replace(/<\s*hr\s*\/?\s*>/gi, '<br><br>')

  for (const tag of STRIP_WRAPPER_TAGS) {
    const open = new RegExp(`<\\s*${tag}[^>]*>`, 'gi')
    const close = new RegExp(`<\\s*\\/\\s*${tag}\\s*>`, 'gi')
    html = html.replace(open, '')
    html = html.replace(close, '')
  }

  return html.trim()
}

export function formatRuneTooltipHtml(rune: {
  longDesc?: string | null
  shortDesc?: string | null
  description?: string | null
}): string {
  return formatTooltipMarkupHtml(rune.longDesc || rune.shortDesc || rune.description || '')
}

/** Colorize plain-text stat shard descriptions (i18n strings without Riot markup). */
export function formatShardTooltipHtml(raw: string | null | undefined): string {
  if (!raw) return ''
  let text = escapeTooltipPlainText(String(raw).trim())

  text = text.replace(
    /(\+\d+(?:\.\d+)?)\s*(Dégâts d'attaque|Attack Damage)\s+ou\s+(\+\d+(?:\.\d+)?)\s*(Puissance magique|Ability Power)/gi,
    (_match, adVal, adLabel, apVal, apLabel) =>
      `${wrapTooltipSpan('scale-ad tooltip-tag', `${adVal} ${adLabel}`)} ou ${wrapTooltipSpan('scale-ap tooltip-tag', `${apVal} ${apLabel}`)}`
  )

  text = text.replace(
    /(\+\d+(?:\.\d+)?%)\s*(Vitesse d'attaque|Attack Speed)/gi,
    (_match, value, label) => wrapTooltipSpan('speed', `${value} ${label}`)
  )

  text = text.replace(
    /(\+\d+(?:\.\d+)?%)\s*(Vitesse de déplacement|Move Speed)/gi,
    (_match, value, label) => wrapTooltipSpan('speed', `${value} ${label}`)
  )

  text = text.replace(
    /(\+\d+(?:\.\d+)?)\s*(Hâte de compétence|Ability Haste)/gi,
    (_match, value, label) => wrapTooltipSpan('stat-haste', `${value} ${label}`)
  )

  text = text.replace(
    /(\+\d+(?:-\d+)?(?:\.\d+)?)\s*(PV|Health(?: Points)?)(?=\s*(?:\(|$))/gi,
    (_match, value, label) => wrapTooltipSpan('scale-hp tooltip-tag', `${value} ${label}`)
  )

  text = text.replace(/(\+\d+(?:\.\d+)?%)\s*(Ténacité|Tenacity)/gi, (_match, value, label) =>
    wrapTooltipSpan('status-cc', `${value} ${label}`)
  )

  return text
}

function normalizeItemStatLabel(label: string): string {
  return label
    .replace(/&nbsp;|&#160;|\u00A0/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
}

function itemStatLabelToTooltipClass(label: string): string | null {
  if (!label) return null
  const compact = label.replace(/[^a-z0-9]/g, '')

  if (compact.includes('degatsdattaque') || compact === 'ad' || label.includes('attack damage')) {
    return 'scale-ad tooltip-tag'
  }
  if (compact.includes('puissance') || compact === 'ap' || label.includes('ability power')) {
    return 'scale-ap tooltip-tag'
  }
  if (label.includes('armure') || label.includes('armor')) return 'scale-armor tooltip-tag'
  if (label.includes('resistance magique') || compact === 'rm' || label.includes('magic resist')) {
    return 'scale-mr tooltip-tag'
  }
  if (compact.includes('vitessedattaque') || label.includes('attack speed')) return 'speed'
  if (label.includes('vitesse de deplacement') || label.includes('move speed')) return 'speed'
  if (
    label.includes('hate') ||
    label.includes('ability haste') ||
    compact.includes('accelerationdecompetence')
  ) {
    return 'stat-haste'
  }
  if (label.includes('tenacite') || label.includes('tenacity')) return 'status-cc'
  if (label.includes('lethalite') || label.includes('lethality')) return 'dmg-physical'
  if (label.includes('omnivamp')) return 'healing'
  if (label.includes('vol de vie') || label.includes('life steal')) return 'healing'
  if (label.includes('vol de sort') || label.includes('spell vamp')) return 'healing'
  if (label.includes('critique') || label.includes('crit')) return 'keyword-major'
  if (
    label.includes('efficacite des soins') ||
    label.includes('heal and shield') ||
    (label.includes('soins') && label.includes('boucliers'))
  ) {
    return 'healing'
  }
  if (label.includes('bouclier') || label.includes('shield')) return 'shield'
  if (
    (label.includes('mana') || label.includes(' mp')) &&
    !label.includes('regen') &&
    !label.includes('regeneration')
  ) {
    return 'scale-mana tooltip-tag'
  }
  if (label.includes('pv') || label.includes('health') || label.includes('sante')) {
    if (label.includes('regen') || label.includes('regeneration')) return 'healing'
    return 'scale-hp tooltip-tag'
  }
  if (/\bpo\b/.test(label) || (label.includes('gold') && label.includes('10'))) return 'gold'
  if (label.includes('gold')) return 'gold'

  return null
}

function colorizeItemAttentionStats(html: string): string {
  return html.replace(
    /<span class="attention">([\s\S]*?)<\/span>([^<]*)/gi,
    (match, value: string, labelRaw: string) => {
      const statClass = itemStatLabelToTooltipClass(normalizeItemStatLabel(labelRaw))
      if (!statClass) return match
      return `<span class="attention ${statClass}">${value}</span>${labelRaw}`
    }
  )
}

/** Rich HTML for item tooltips (stats block, passives, gold quest lines). */
export function formatItemTooltipHtml(raw: string | null | undefined): string {
  const html = formatTooltipMarkupHtml(raw)
  if (!html) return ''
  return colorizeItemAttentionStats(html)
}
