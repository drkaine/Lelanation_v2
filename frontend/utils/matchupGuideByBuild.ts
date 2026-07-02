import type { MatchupGuide } from '@lelanation/shared-types'

export function getMatchupGuideBuildId(guide: MatchupGuide): string | null {
  if (typeof guide.buildId === 'string' && guide.buildId.length > 0) return guide.buildId
  const embedded = guide.build?.id
  return typeof embedded === 'string' && embedded.length > 0 ? embedded : null
}

export function findMatchupGuideForBuildId(
  buildId: string,
  guides: Iterable<MatchupGuide>
): MatchupGuide | null {
  if (!buildId) return null
  for (const guide of guides) {
    if (getMatchupGuideBuildId(guide) === buildId) return guide
  }
  return null
}

export function buildMatchupGuideByBuildIdMap(guides: MatchupGuide[]): Map<string, MatchupGuide> {
  const map = new Map<string, MatchupGuide>()
  for (const guide of guides) {
    const id = getMatchupGuideBuildId(guide)
    if (typeof id === 'string' && id.length > 0 && !map.has(id)) {
      map.set(id, guide)
    }
  }
  return map
}
