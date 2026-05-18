/**
 * Kayn transformation form colors (Shadow Assassin / Darkin Slayer).
 * Works across locales via label matching, not hard-coded French only.
 */
const KAYN_DARKIN_COLOR = '#fe5c50'
const KAYN_SHADOW_COLOR = '#8484fb'

const SHADOW_FORM_LABEL_RE = /Shadow Assassin|Assassin de l['']ombre/i
const DARKIN_FORM_LABEL_RE = /Darkin Slayer|Tueur [Dd]arkin/i

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
