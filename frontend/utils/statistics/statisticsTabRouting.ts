import { STATISTICS_MAIN_TAB_ORDER } from '~/constants/statisticsMainTabs'
import { type StatisticsMainTab } from '~/stores/StatisticsUiStore'

export function queryFirst(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export type StatisticsTabSection =
  | 'infos-overview'
  | 'tierlist-champion'
  | 'items'
  | 'runes-summoner'
  | 'objectives'
  | 'team-bans'
  | 'balance-progression'
  | 'synergy-botlane'

export const STATISTICS_SECTION_TABS: Record<StatisticsTabSection, StatisticsMainTab[]> = {
  'infos-overview': ['infos', 'overview'],
  'tierlist-champion': ['championTable'],
  items: ['items'],
  'runes-summoner': ['runes', 'spells'],
  objectives: ['objectives'],
  'team-bans': ['team', 'bans'],
  'balance-progression': ['balance', 'trends'],
  'synergy-botlane': ['championTable'],
}

export function sectionFromQuery(): StatisticsTabSection | null {
  // Keep all tabs visible regardless of legacy `?section=` deep-links.
  return null
}

export function normalizeTabForSection(
  section: StatisticsTabSection | null,
  tab: StatisticsMainTab
): StatisticsMainTab {
  if (!section) return tab
  const allowedTabs = STATISTICS_SECTION_TABS[section]
  if (allowedTabs.includes(tab)) return tab
  return allowedTabs[0] ?? tab
}

export function normalizeLegacyTab(tab: string): StatisticsMainTab {
  if (tab === 'tierlist') return 'overview'
  if (tab === 'champions') return 'infos'
  // if (tab === 'progressions') return 'trends'
  if (tab === 'sides') return 'team'
  if (tab === 'detail') return 'runes'
  if (tab === 'duration') return 'team'
  if (tab === 'abandons') return 'team'
  if (tab === 'champion-table' || tab === 'championstable') return 'championTable'
  if (
    tab === 'overview' ||
    tab === 'championTable' ||
    tab === 'balance' ||
    // tab === 'trends' ||
    tab === 'team' ||
    tab === 'objectives' ||
    tab === 'surrender' ||
    tab === 'bans' ||
    tab === 'runes' ||
    tab === 'items' ||
    tab === 'spells' ||
    tab === 'infos' ||
    tab === 'pings' ||
    tab === 'vision' ||
    tab === 'misc' ||
    tab === 'patchNotes'
  ) {
    return tab
  }
  return 'overview'
}

export function isStatisticsMainTab(tab: string): tab is StatisticsMainTab {
  return (STATISTICS_MAIN_TAB_ORDER as readonly string[]).includes(tab)
}

export function statisticsTabNeedsOverviewLoad(tab: StatisticsMainTab): boolean {
  return tab === 'overview' || tab === 'objectives' || tab === 'infos'
}
