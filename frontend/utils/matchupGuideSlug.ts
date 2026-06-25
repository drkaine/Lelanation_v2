/** URL slug for a matchup guide author segment. */
export function matchupGuideAuthorSlug(author?: string): string {
  const raw = author?.trim() || 'anonymous'
  const slug = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'anonymous'
}

export function matchupGuideDetailPath(
  guide: { id: string; author?: string },
  localePath?: (path: string) => string
): string {
  const path = `/matchups/sheets/${matchupGuideAuthorSlug(guide.author)}/${encodeURIComponent(guide.id)}`
  return localePath ? localePath(path) : path
}

export function matchupGuideAuthorSlugMatches(
  guide: { author?: string },
  authorParam: string
): boolean {
  return matchupGuideAuthorSlug(guide.author) === String(authorParam ?? '').toLowerCase()
}
