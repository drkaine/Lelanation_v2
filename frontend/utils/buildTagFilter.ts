import { buildHasAnyNotes } from '~/utils/buildNotes'
import { showLelarivaBadge } from '~/utils/sharedBuildSync'

type TaggableBuild = {
  id?: string
  tags?: string[]
  subBuilds?: Array<{ tags?: string[] }>
  lelarivaBadge?: boolean
  teamShared?: boolean
  visibility?: string
}

/** Filtre de tag de Découvrir : tags du build ou des sous-builds, notes, badge Lelariva. */
export function buildMatchesTag(
  build: TaggableBuild,
  tag: string,
  guidedBuildIds?: ReadonlySet<string>
): boolean {
  if (tag === 'guide') return !!build.id && !!guidedBuildIds?.has(build.id)
  if (tag === 'notes') return buildHasAnyNotes(build as Parameters<typeof buildHasAnyNotes>[0])
  if (tag === 'lelariva') return showLelarivaBadge(build)
  if (build.tags?.includes(tag)) return true
  return (build.subBuilds ?? []).some(sub => sub.tags?.includes(tag))
}

/** Le tag Lelariva n'apparaît dans la liste que si au moins un build public le porte. */
export function hasLelarivaBuild(builds: readonly TaggableBuild[]): boolean {
  return builds.some(b => b.visibility !== 'private' && showLelarivaBadge(b))
}

/** Le tag Guide n'apparaît que si au moins un build public a un guide lié. */
export function hasGuidedBuild(
  builds: readonly TaggableBuild[],
  guidedBuildIds: ReadonlySet<string>
): boolean {
  return builds.some(b => b.visibility !== 'private' && !!b.id && guidedBuildIds.has(b.id))
}

/** Chip de tag cliqué : ajouté s'il manque, retiré s'il est déjà sélectionné. */
export function toggleTagInList<T extends string>(tags: readonly T[], tag: T): T[] {
  return tags.includes(tag) ? tags.filter(value => value !== tag) : [...tags, tag]
}

/** Plusieurs chips sélectionnés : le build doit les porter tous. */
export function buildMatchesAllTags(
  build: TaggableBuild,
  tags: readonly string[],
  guidedBuildIds?: ReadonlySet<string>
): boolean {
  return tags.every(tag => buildMatchesTag(build, tag, guidedBuildIds))
}
