import type { Build, StoredBuild } from '@lelanation/shared-types'

const MATCHUP_GUIDES_STORAGE_KEY = 'lelanation_matchup_guides'

type GuideBuildRef = { build?: { id?: string; matchupGuideEmbed?: boolean } }

export function isStandaloneLibraryBuild(
  build: Pick<Build | StoredBuild, 'id' | 'matchupGuideEmbed'>
): boolean {
  if (build.matchupGuideEmbed === true) return false
  return !getMatchupGuideEmbeddedBuildIds().has(build.id)
}

export function getMatchupGuideEmbeddedBuildIds(): Set<string> {
  if (import.meta.server) return new Set()
  try {
    const raw = localStorage.getItem(MATCHUP_GUIDES_STORAGE_KEY)
    if (!raw) return new Set()
    const guides = JSON.parse(raw) as GuideBuildRef[]
    if (!Array.isArray(guides)) return new Set()
    const ids = new Set<string>()
    for (const guide of guides) {
      const id = guide.build?.id
      if (typeof id === 'string' && id.length > 0) ids.add(id)
    }
    return ids
  } catch {
    return new Set()
  }
}

export function filterStandaloneLibraryBuilds<T extends Pick<Build, 'id' | 'matchupGuideEmbed'>>(
  builds: T[]
): T[] {
  const embeddedIds = getMatchupGuideEmbeddedBuildIds()
  return builds.filter(build => build.matchupGuideEmbed !== true && !embeddedIds.has(build.id))
}
