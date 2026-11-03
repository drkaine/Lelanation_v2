import type { Build } from '@lelanation/shared-types'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'
import { searchAnyIncludes } from '~/utils/searchText'

export type BuildPickerTab = 'favorites' | 'discover' | 'mine'

export const BUILD_PICKER_TABS: BuildPickerTab[] = ['favorites', 'discover', 'mine']

export interface BuildPickerSources {
  saved: Build[]
  discovery: Build[]
  favoriteIds: string[]
}

function byRecent(builds: Build[]): Build[] {
  return [...builds].sort((a, b) =>
    String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
  )
}

function tabBuilds(tab: BuildPickerTab, sources: BuildPickerSources): Build[] {
  const saved = filterStandaloneLibraryBuilds(sources.saved)
  if (tab === 'mine') return byRecent(saved)
  if (tab === 'discover') return sources.discovery
  const byId = new Map<string, Build>()
  for (const build of saved) byId.set(build.id, build)
  for (const build of sources.discovery) if (!byId.has(build.id)) byId.set(build.id, build)
  return sources.favoriteIds.map(id => byId.get(id)).filter((b): b is Build => Boolean(b))
}

/** Builds d'un onglet du sélecteur, filtrés par titre, auteur ou champion. */
export function buildPickerList(
  tab: BuildPickerTab,
  sources: BuildPickerSources,
  query: string
): Build[] {
  const builds = tabBuilds(tab, sources)
  if (!query.trim()) return builds
  return builds.filter(build =>
    searchAnyIncludes(query, [build.name, build.author, build.champion?.name, build.champion?.id])
  )
}
