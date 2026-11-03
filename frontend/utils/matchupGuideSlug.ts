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

type GuidePathInput = {
  id: string
  author?: string
  buildId?: string
  build?: { id?: string } | null
}

/** Build réel du guide (`null` si aucun, ou si `buildId` vaut l'id du guide : guide de démo). */
function linkedBuildId(guide: GuidePathInput): string | null {
  const id = guide.buildId || guide.build?.id || ''
  return id && id !== guide.id ? id : null
}

/** Guide lié à un build : onglet guide de la page du build. Sinon : page guide autonome. */
export function matchupGuideDetailPath(
  guide: GuidePathInput,
  localePath?: (path: string) => string
): string {
  const buildId = linkedBuildId(guide)
  const path = buildId
    ? `/builds/${encodeURIComponent(buildId)}`
    : `/matchups/sheets/${matchupGuideAuthorSlug(guide.author)}/${encodeURIComponent(guide.id)}`
  const localized = localePath ? localePath(path) : path
  return buildId ? `${localized}?tab=guide` : localized
}

export function matchupGuideAuthorSlugMatches(
  guide: { author?: string },
  authorParam: string
): boolean {
  return matchupGuideAuthorSlug(guide.author) === String(authorParam ?? '').toLowerCase()
}
