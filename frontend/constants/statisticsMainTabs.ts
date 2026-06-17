import type { StatisticsMainTab } from '~/stores/StatisticsUiStore'

/** Ordre d’affichage des onglets sur /statistics (barre + paramétrage). */
export const STATISTICS_MAIN_TAB_ORDER: readonly StatisticsMainTab[] = [
  'overview',
  'team',
  'objectives',
  'surrender',
  'bans',
  'championTable',
  'balance',
  'runes',
  'spells',
  'items',
  'pings',
  'vision',
  'misc',
  'patchNotes',
  'infos',
] as const

export const STATISTICS_MAIN_TAB_LABEL_KEYS: Record<StatisticsMainTab, string> = {
  overview: 'statisticsPage.tabOverview',
  team: 'statisticsPage.tabTeam',
  objectives: 'statisticsPage.tabObjectives',
  surrender: 'statisticsPage.tabSurrender',
  bans: 'statisticsPage.tabBans',
  championTable: 'statisticsPage.tabChampionTable',
  balance: 'statisticsPage.tabBalance',
  trends: 'statisticsPage.tabTrends',
  runes: 'statisticsPage.tabRunes',
  spells: 'statisticsPage.tabSummonerSpells',
  items: 'statisticsPage.tabItems',
  pings: 'statisticsPage.tabPings',
  vision: 'statisticsPage.tabVision',
  misc: 'statisticsPage.tabMisc',
  patchNotes: 'statisticsPage.tabPatchNotes',
  infos: 'statisticsPage.tabInfos',
}
