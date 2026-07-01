/** Shared UI color class helpers — keep Tailwind/class strings aligned with tokens.css */

export function uiFavoriteActionClass(active: boolean): string {
  return active ? 'ui-action-favorite is-active' : 'ui-action-favorite'
}

export function uiUpvoteActionClass(active: boolean): string {
  return active ? 'ui-action-upvote is-active' : 'ui-action-upvote'
}

export function uiDownvoteActionClass(active: boolean): string {
  return active ? 'ui-action-downvote is-active' : 'ui-action-downvote'
}

export function uiTierBadgeClass(tier: string): string {
  const label = tier.toUpperCase()
  if (label === 'S' || label === 'S+') return 'ui-tier-badge ui-tier-badge--s'
  if (label === 'A' || label === 'A+') return 'ui-tier-badge ui-tier-badge--a'
  if (label === 'B' || label === 'B+') return 'ui-tier-badge ui-tier-badge--b'
  return 'ui-tier-badge ui-tier-badge--default'
}

/** Solid tier note badge — same palette as statistics tier list table. */
export function uiStatisticsTierBadgeClass(tier: string): string {
  const label = String(tier ?? '')
    .trim()
    .toUpperCase()
    .replace(/^F$/, 'D')
  if (label === 'S+') return 'ui-statistics-tier-badge ui-statistics-tier-badge--s-plus'
  if (label === 'S') return 'ui-statistics-tier-badge ui-statistics-tier-badge--s'
  if (label === 'A') return 'ui-statistics-tier-badge ui-statistics-tier-badge--a'
  if (label === 'B') return 'ui-statistics-tier-badge ui-statistics-tier-badge--b'
  if (label === 'C') return 'ui-statistics-tier-badge ui-statistics-tier-badge--c'
  return 'ui-statistics-tier-badge ui-statistics-tier-badge--d'
}

export function uiBuildTagClass(tag: 'pro' | 'otp' | 'exotique' | 'troll'): string {
  return `ui-tag ui-tag--${tag}`
}

/** Active filter chip (statistics pages). */
export const UI_FILTER_CHIP_ACTIVE =
  'border-info/60 bg-info/20 text-primary-light ring-1 ring-info/60'

/** Default filter chip. */
export const UI_FILTER_CHIP = 'bg-black/20 hover:bg-white/10'

/** Positive delta / winrate emphasis. */
export function uiStatPositiveClass(opacity = ''): string {
  return opacity ? `text-info/${opacity}` : 'text-info'
}

/** Negative delta / winrate emphasis. */
export function uiStatNegativeClass(opacity = ''): string {
  return opacity ? `text-error/${opacity}` : 'text-error'
}

/** Neutral / average stat tone. */
export function uiStatNeutralClass(opacity = '85'): string {
  return `text-primary-light/${opacity}`
}

/** Signed numeric delta (percentage points). */
export function uiSignedDeltaClass(
  value: number,
  threshold = 0.05,
  opts?: { positive?: string; negative?: string; neutral?: string }
): string {
  if (value > threshold) return opts?.positive ?? uiStatPositiveClass('90')
  if (value < -threshold) return opts?.negative ?? uiStatNegativeClass('90')
  return opts?.neutral ?? 'text-text/75'
}

/** Win rate heat scale for table cells. */
export function uiWinrateHeatClass(pct: number): string {
  if (pct >= 52.5) return 'font-medium text-info'
  if (pct >= 51) return 'text-info/95'
  if (pct >= 50) return uiStatNeutralClass()
  return uiStatNegativeClass('90')
}

/** Pick/ban rate heat scale. */
export function uiPickrateHeatClass(pct: number): string {
  if (pct >= 15) return uiStatPositiveClass('90')
  if (pct >= 6) return uiStatNeutralClass()
  return 'text-text/70'
}

/** Compare two values (higher is better). */
export function uiCompareHighClass(hi: boolean, lo: boolean): string {
  if (hi) return uiStatPositiveClass('90')
  if (lo) return uiStatNegativeClass('90')
  return 'text-text/75'
}

/** Compare signed number (n > 0 good). */
export function uiSignedNumberClass(n: number): string {
  if (n > 0) return uiStatPositiveClass('90')
  if (n < 0) return uiStatNegativeClass('90')
  return 'text-text/75'
}

/** Reset / link button on statistics filter bars. */
export const UI_STATS_FILTER_RESET =
  'text-primary-light transition-colors hover:bg-info/15 hover:text-primary-light'
