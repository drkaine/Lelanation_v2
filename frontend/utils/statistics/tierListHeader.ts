export type TierListView = 'table' | 'chart' | 'botlaneMatchups' | 'botlaneDuoRank'

/** Onglets en pilule sous la nav (maquette Tier list). */
export const TIER_LIST_VIEWS: readonly {
  id: TierListView
  labelKey: string
  shortLabelKey: string
}[] = [
  {
    id: 'table',
    labelKey: 'statisticsPage.navTierList',
    shortLabelKey: 'statisticsPage.tierListViewShortTable',
  },
  {
    id: 'chart',
    labelKey: 'statisticsPage.tierListViewChart',
    shortLabelKey: 'statisticsPage.tierListViewShortChart',
  },
  {
    id: 'botlaneMatchups',
    labelKey: 'statisticsPage.tierListViewBotlaneMatchups',
    shortLabelKey: 'statisticsPage.tierListViewShortDuos',
  },
  {
    id: 'botlaneDuoRank',
    labelKey: 'statisticsPage.tierListViewBotlaneDuoRank',
    shortLabelKey: 'statisticsPage.tierListViewShortRanking',
  },
]

/** « PATCH x · RANKED SOLO/DUO » : le patch est omis quand aucun n'est choisi. */
export function tierListEyebrowParts(version: string, queueLabel: string): string[] {
  const v = version.trim()
  return v ? [`Patch ${v}`, queueLabel] : [queueLabel]
}

const VIEW_QUERY: Record<TierListView, string | undefined> = {
  table: undefined,
  chart: 'chart',
  botlaneMatchups: 'botlane-matchups',
  botlaneDuoRank: 'botlane-duos',
}

/** Valeur de `?view=` lue par la page tier list (undefined = tableau par défaut). */
export function tierListViewQuery(view: TierListView): string | undefined {
  return VIEW_QUERY[view]
}
