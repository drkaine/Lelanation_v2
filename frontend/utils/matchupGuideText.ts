import type { MatchupGuide } from '@lelanation/shared-types'

/** Max characters shown on matchup guide cards (detail page keeps the full text). */
export const MATCHUP_GUIDE_SHORT_DESCRIPTION_MAX = 110

export function truncateMatchupGuideText(
  text: string,
  max = MATCHUP_GUIDE_SHORT_DESCRIPTION_MAX
): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed

  const sliced = trimmed.slice(0, max)
  const lastSpace = sliced.lastIndexOf(' ')
  const cut = lastSpace > max * 0.55 ? sliced.slice(0, lastSpace) : sliced
  return `${cut.trimEnd()}…`
}

export function matchupGuideCardDescription(guide: MatchupGuide): string {
  const explicit = guide.shortDescription?.trim()
  if (explicit) return truncateMatchupGuideText(explicit)

  const long = guide.description?.trim()
  if (!long) return ''
  return truncateMatchupGuideText(long)
}

export function matchupGuideDetailDescription(guide: MatchupGuide): string {
  return guide.description?.trim() ?? ''
}
