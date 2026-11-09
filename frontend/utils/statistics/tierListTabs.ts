export type TierListMainView = 'table' | 'chart' | 'botlaneMatchups' | 'botlaneDuoRank'
export type TierListChartType = 'pbi' | 'bubble'
/** Onglets de la page tier list : « Graphique » = score matchup, « Méta » = WR vs pick. */
export type TierListTab = TierListMainView | 'meta'

export type TierListTabState = {
  view: TierListMainView
  chartType: TierListChartType | null
  query: 'chart' | 'meta' | null
}

export function tierListTabState(tab: TierListTab): TierListTabState {
  if (tab === 'meta') return { view: 'chart', chartType: 'bubble', query: 'meta' }
  if (tab === 'chart') return { view: 'chart', chartType: 'pbi', query: 'chart' }
  return { view: tab, chartType: null, query: null }
}

export function tierListTabOf(view: TierListMainView, chartType: TierListChartType): TierListTab {
  if (view === 'chart') return chartType === 'bubble' ? 'meta' : 'chart'
  return view
}

export function tierListViewFromQuery(raw: string): 'chart' | 'meta' | null {
  return raw === 'chart' || raw === 'meta' ? raw : null
}
