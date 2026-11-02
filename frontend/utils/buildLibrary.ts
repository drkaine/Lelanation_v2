import type { Build, StoredBuild } from '@lelanation/shared-types'

const MATCHUP_GUIDES_STORAGE_KEY = 'lelanation_matchup_guides'

type GuideBuildRef = { buildId?: string; build?: { id?: string; matchupGuideEmbed?: boolean } }

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
      const id = guide.buildId ?? guide.build?.id
      if (typeof id === 'string' && id.length > 0) ids.add(id)
    }
    return ids
  } catch {
    return new Set()
  }
}

/** Builds de la bibliothèque perso : ni embarqués dans un guide, ni partagés à l'équipe (onglet Builds team). */
export function filterStandaloneLibraryBuilds<
  T extends Pick<Build, 'id' | 'matchupGuideEmbed'> & { teamShared?: boolean },
>(builds: T[]): T[] {
  const embeddedIds = getMatchupGuideEmbeddedBuildIds()
  return builds.filter(
    build =>
      build.matchupGuideEmbed !== true && build.teamShared !== true && !embeddedIds.has(build.id)
  )
}
