import type { Build, StoredBuild } from '@lelanation/shared-types'

/**
 * Build de la bibliothèque perso : pas une copie embarquée dans un guide (`matchupGuideEmbed`).
 * Un build simplement lié à un guide (`guide.buildId`) reste dans la bibliothèque.
 */
export function isStandaloneLibraryBuild(
  build: Pick<Build | StoredBuild, 'id' | 'matchupGuideEmbed'>
): boolean {
  return build.matchupGuideEmbed !== true
}

/** Builds de la bibliothèque perso : ni embarqués dans un guide, ni partagés à l'équipe (onglet Builds team). */
export function filterStandaloneLibraryBuilds<
  T extends Pick<Build, 'id' | 'matchupGuideEmbed'> & { teamShared?: boolean },
>(builds: T[]): T[] {
  return builds.filter(build => isStandaloneLibraryBuild(build) && build.teamShared !== true)
}
