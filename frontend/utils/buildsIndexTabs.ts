import type { UserRole } from '~/utils/userSession'

export type BuildsIndexTab = 'discover' | 'my-builds' | 'favoris' | 'team' | 'lelariva'

const TAB_PATHS: Record<BuildsIndexTab, string> = {
  discover: '/builds/discover',
  'my-builds': '/builds/my-builds',
  favoris: '/builds/favoris',
  team: '/builds/team',
  lelariva: '/statistics/lelariva',
}

/** Chemin de la page d'un onglet Builds (Découvrir par défaut). */
export function buildsTabPath(tab: string): string {
  return TAB_PATHS[tab as BuildsIndexTab] ?? TAB_PATHS.discover
}

/** Onglet Builds déduit du chemin (préfixe de langue toléré). */
export function buildsTabFromPath(path: string): BuildsIndexTab | undefined {
  for (const tab of ['discover', 'my-builds', 'favoris', 'team'] as const) {
    if (path.endsWith(TAB_PATHS[tab])) return tab
  }
  return undefined
}

/** Onglet « Builds team » : tout compte connecté (admin, lelariva, lelateam). */
export function showTeamBuildsTab(role: UserRole | null): boolean {
  return role !== null
}

/** Onglet d'arrivée après création, modification ou suppression : Team pour un build d'équipe. */
export function tabAfterBuildChange(
  build: { teamShared?: boolean } | null | undefined
): 'team' | 'my-builds' {
  return build?.teamShared === true ? 'team' : 'my-builds'
}
