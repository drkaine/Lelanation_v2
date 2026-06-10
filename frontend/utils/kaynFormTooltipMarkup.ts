/**
 * Kayn transformation form colors (Shadow Assassin / Darkin Slayer).
 * Works across locales via label matching, not hard-coded French only.
 */
const KAYN_DARKIN_COLOR = '#fe5c50'
const KAYN_SHADOW_COLOR = '#8484fb'

const SHADOW_FORM_LABEL_RE = /Shadow Assassin|Assassin de l['']ombre\s*:/i
const DARKIN_FORM_LABEL_RE = /Darkin(?:\s+Slayer)?\s*:|Tueur [Dd]arkin/i

function isShadowFormLabel(text: string): boolean {
  return SHADOW_FORM_LABEL_RE.test(text)
}

function isDarkinFormLabel(text: string): boolean {
  return DARKIN_FORM_LABEL_RE.test(text)
}

/** Normalize Riot font colors + keyword-major form headers into semantic classes. */
export function normalizeKaynFormMarkup(html: string): string {
  if (!html) return ''

  let out = String(html)

  // Passive / legacy Riot markup uses inline font colors.
  out = out.replace(/<font\s+color=["']#fe5c50["']>/gi, '<span class="kayn-form-darkin">')
  out = out.replace(/<font\s+color=["']#8484fb["']>/gi, '<span class="kayn-form-shadow">')
  out = out.replace(/<\/font>/gi, '</span>')

  // Spell detail blocks: <span class="keyword-major">Assassin de l'ombre :</span>
  out = out.replace(/<span class="keyword-major">([^<]*)<\/span>/gi, (match, inner: string) => {
    if (isShadowFormLabel(inner)) {
      return `<span class="kayn-form-shadow">${inner}</span>`
    }
    if (isDarkinFormLabel(inner)) {
      return `<span class="kayn-form-darkin">${inner}</span>`
    }
    return match
  })

  return out
}

export const KAYN_FORM_CSS_COLORS = {
  darkin: KAYN_DARKIN_COLOR,
  shadow: KAYN_SHADOW_COLOR,
} as const

export const KAYN_CHAMPION_ID = 'Kayn'

/** 0 = base Kayn, 1 = Darkin (rouge), 2 = Assassin (bleu). */
export type KaynBuilderForm = 0 | 1 | 2

export type KaynFormFilter = 1 | 2

export function getKaynDisplayName(form: KaynBuilderForm): string {
  if (form === 1) return 'Darkin'
  if (form === 2) return 'Assassin'
  return 'Kayn'
}

function sectionKaynFormAffinity(section: string): 'darkin' | 'shadow' | 'neutral' {
  const text = String(section ?? '')
  const hasDarkin = /kayn-form-darkin/i.test(text) || isDarkinFormLabel(text)
  const hasShadow = /kayn-form-shadow/i.test(text) || isShadowFormLabel(text)
  if (hasDarkin && !hasShadow) return 'darkin'
  if (hasShadow && !hasDarkin) return 'shadow'
  if (hasDarkin && hasShadow) return 'neutral'
  return 'neutral'
}

/** Garde les blocs neutres + ceux de la forme choisie (tooltips builder Kayn). */
export function filterKaynDetailedTexts(sections: string[], form: KaynFormFilter): string[] {
  const target = form === 1 ? 'darkin' : 'shadow'
  return sections
    .map(section => String(section ?? '').trim())
    .filter(section => section.length > 0)
    .filter(section => {
      const affinity = sectionKaynFormAffinity(section)
      return affinity === 'neutral' || affinity === target
    })
}

function splitKaynTooltipSections(html: string): string[] {
  const trimmed = String(html ?? '').trim()
  if (!trimmed) return []

  const byParagraph = trimmed
    .split(/<br\s*\/?>\s*<br\s*\/?>/gi)
    .map(part => part.trim())
    .filter(part => part.length > 0)
  if (byParagraph.length > 1) return byParagraph

  const byFormHeader = trimmed
    .split(
      /(?=<span class="kayn-form-(?:darkin|shadow)">(?:Darkin|Tueur [Dd]arkin|Darkin Slayer|Assassin|Shadow Assassin|Assassin de l['']ombre))/i
    )
    .map(part => part.trim())
    .filter(part => part.length > 0)
  if (byFormHeader.length > 1) return byFormHeader

  return [trimmed]
}

export function filterKaynTooltipHtml(html: string, form: KaynFormFilter): string {
  const trimmed = String(html ?? '').trim()
  if (!trimmed) return ''

  const parts = splitKaynTooltipSections(trimmed)
  if (parts.length <= 1) {
    const affinity = sectionKaynFormAffinity(trimmed)
    const target = form === 1 ? 'darkin' : 'shadow'
    if (affinity === 'neutral' || affinity === target) return trimmed
    return ''
  }
  return filterKaynDetailedTexts(parts, form).join('<br><br>')
}
