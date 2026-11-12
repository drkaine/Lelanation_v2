export type ChampionTabId =
  | 'overview'
  | 'dashboard'
  | 'matchups'
  | 'synergy'
  | 'runes'
  | 'spells'
  | 'skills'
  | 'objectives'
  | 'pings'
  | 'vision'
  | 'misc'
  | 'builds'

export type ChampionTabGroupId = 'overview' | 'build' | 'matchups' | 'stats' | 'builds'

export interface ChampionTabGroup {
  id: ChampionTabGroupId
  label: string
  tabs: readonly ChampionTabId[]
}

/** Regroupement mobile des onglets de la fiche champion (maquette MChampionPage). */
export const CHAMPION_TAB_GROUPS: readonly ChampionTabGroup[] = [
  {
    id: 'overview',
    label: 'statisticsPage.championGroupOverview',
    tabs: ['overview'],
  },
  { id: 'build', label: 'statisticsPage.championGroupBuild', tabs: ['runes', 'skills', 'spells'] },
  {
    id: 'matchups',
    label: 'statisticsPage.championGroupMatchups',
    tabs: ['matchups', 'synergy'],
  },
  {
    id: 'stats',
    label: 'statisticsPage.championGroupStats',
    tabs: ['dashboard', 'objectives', 'vision', 'misc'],
  },
  { id: 'builds', label: 'statisticsPage.championStatsTabBuilds', tabs: ['builds'] },
]

export function championTabGroupOf(tab: ChampionTabId): ChampionTabGroupId {
  // Pings : fusionnés dans « Vision & pings » (maquette 27).
  if (tab === 'pings') return 'stats'
  return CHAMPION_TAB_GROUPS.find(g => g.tabs.includes(tab))?.id ?? 'overview'
}

export function championTabsInGroup(group: ChampionTabGroupId): readonly ChampionTabId[] {
  return CHAMPION_TAB_GROUPS.find(g => g.id === group)?.tabs ?? ['overview']
}
