import type { Build } from '@lelanation/shared-types'

/** Builds publics d'un champion (id Data Dragon, ex. « Graves »), du plus récent au plus ancien. */
export function championBuildsList(builds: readonly Build[], championId: string): Build[] {
  const wanted = championId.trim().toLowerCase()
  if (!wanted) return []
  return builds
    .filter(b => b.visibility !== 'private' && b.champion?.id?.toLowerCase() === wanted)
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
}
