import type { StatisticsMainTab } from '~/stores/StatisticsUiStore'

export type StatisticsNavGroupId =
  | 'overview'
  | 'tierList'
  | 'champions'
  | 'teamObjectives'
  | 'bans'
  | 'builds'
  | 'behavior'
  | 'patchNotes'
  | 'infos'

export type StatisticsNavGroup = {
  id: StatisticsNavGroupId
  labelKey: string
  tabs: StatisticsMainTab[]
  /** Section servie par une autre page (pas un onglet). */
  route?: string
}

/** Sections de la maquette « Redesign Statistiques » (nav principale). */
export const STATISTICS_NAV_GROUPS: readonly StatisticsNavGroup[] = [
  { id: 'overview', labelKey: 'statisticsPage.navOverview', tabs: ['overview'] },
  {
    id: 'tierList',
    labelKey: 'statisticsPage.navTierList',
    tabs: [],
    route: '/statistics/tier-list',
  },
  {
    id: 'champions',
    labelKey: 'statisticsPage.navChampions',
    tabs: ['championTable', 'balance', 'misc'],
  },
  {
    id: 'teamObjectives',
    labelKey: 'statisticsPage.navTeamObjectives',
    tabs: ['team', 'objectives', 'surrender'],
  },
  { id: 'bans', labelKey: 'statisticsPage.navBans', tabs: ['bans'] },
  { id: 'builds', labelKey: 'statisticsPage.navBuilds', tabs: ['runes', 'spells', 'items'] },
  { id: 'behavior', labelKey: 'statisticsPage.navBehavior', tabs: ['pings', 'vision'] },
  { id: 'patchNotes', labelKey: 'statisticsPage.navPatchNotes', tabs: ['patchNotes'] },
  { id: 'infos', labelKey: 'statisticsPage.navInfos', tabs: ['infos'] },
]

export function navGroupOfTab(tab: StatisticsMainTab): StatisticsNavGroupId | null {
  return STATISTICS_NAV_GROUPS.find(g => g.tabs.includes(tab))?.id ?? null
}

/** Sections à afficher : celles qui ont au moins un onglet visible, ou une page dédiée. */
export function visibleNavGroups(visibleTabs: readonly StatisticsMainTab[]): StatisticsNavGroup[] {
  const visible = new Set(visibleTabs)
  return STATISTICS_NAV_GROUPS.map(g => ({
    ...g,
    tabs: g.tabs.filter(t => visible.has(t)),
  })).filter(g => g.route != null || g.tabs.length > 0)
}

export type StatisticsNavTarget = { path: string; query?: { tab: StatisticsMainTab } }

/** Lien d’une section depuis une autre page : page dédiée, ou index avec `?tab=`. */
export function navGroupTarget(group: StatisticsNavGroup): StatisticsNavTarget {
  if (group.route) return { path: group.route }
  const tab = group.tabs[0]
  if (!tab || tab === 'overview') return { path: '/statistics' }
  return { path: '/statistics', query: { tab } }
}
