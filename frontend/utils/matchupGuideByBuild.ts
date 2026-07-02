import type { MatchupGuide } from '@lelanation/shared-types'

export function findMatchupGuideForBuildId(
  buildId: string,
  guides: Iterable<MatchupGuide>
): MatchupGuide | null {
  if (!buildId) return null
  for (const guide of guides) {
    if (guide.build?.id === buildId) return guide
  }
  return null
}

export function buildMatchupGuideByBuildIdMap(guides: MatchupGuide[]): Map<string, MatchupGuide> {
  const map = new Map<string, MatchupGuide>()
  for (const guide of guides) {
    const id = guide.build?.id
    if (typeof id === 'string' && id.length > 0 && !map.has(id)) {
      map.set(id, guide)
    }
  }
  return map
}
