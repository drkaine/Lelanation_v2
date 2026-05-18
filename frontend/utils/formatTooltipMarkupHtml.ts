const STRIP_WRAPPER_TAGS = ['mainText', 'rules', 'section', 'ornnBonus']

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

export function formatTooltipMarkupHtml(raw: string | null | undefined): string {
  if (!raw) return ''
  let html = String(raw)

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
