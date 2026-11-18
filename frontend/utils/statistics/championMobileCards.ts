import type { ChampionColumnGroup, ChampionColumnMode } from './championColumnGroups'
import {
  CHAMPION_DESKTOP_COLUMNS,
  type ChampionDesktopField,
  type ChampionDesktopSort,
} from './championDesktopColumns'

/** Cartes mobiles de l'onglet Champions (maquette 11) : valeur principale + 3 sous-stats + KDA. */
export type ChampionMobileField =
  | 'avgDamageToChamps'
  | 'avgDamageTakenTotal'
  | 'avgTotalHeal'
  | 'avgDamageSelfMitigated'
  | 'avgTimeCcDealt'

export const CHAMPION_MOBILE_METRICS: ReadonlyArray<{
  sort: ChampionDesktopSort
  field: ChampionMobileField
}> = [
  { sort: 'dmgTotal', field: 'avgDamageToChamps' },
  { sort: 'takenTotal', field: 'avgDamageTakenTotal' },
  { sort: 'healTotal', field: 'avgTotalHeal' },
  { sort: 'mitigated', field: 'avgDamageSelfMitigated' },
  { sort: 'ccTime', field: 'avgTimeCcDealt' },
]

const SUB_ORDER: ChampionMobileField[] = [
  'avgDamageToChamps',
  'avgDamageTakenTotal',
  'avgTotalHeal',
  'avgTimeCcDealt',
]

const GROUP_MAIN: Record<ChampionColumnGroup, ChampionMobileField> = {
  heal: 'avgTotalHeal',
  dealt: 'avgDamageToChamps',
  taken: 'avgDamageTakenTotal',
}

function groupOf(field: ChampionDesktopField): ChampionColumnGroup | undefined {
  return CHAMPION_DESKTOP_COLUMNS.find(c => c.field === field)?.group
}

/** Métriques proposées au choix selon le mode de colonnes (Tout / Soins / Infligés / Reçus). */
export function championMobileMetricsFor(mode: ChampionColumnMode = 'all') {
  return mode === 'all'
    ? CHAMPION_MOBILE_METRICS
    : CHAMPION_MOBILE_METRICS.filter(m => groupOf(m.field) === mode)
}

export function championMobileMetric(
  sortColumn: string,
  mode: ChampionColumnMode = 'all'
): ChampionMobileField {
  const base = sortColumn.replace(/Delta$/, '')
  const found = championMobileMetricsFor(mode).find(m => m.sort === base)?.field
  return found ?? (mode === 'all' ? 'avgDamageToChamps' : GROUP_MAIN[mode])
}

export type ChampionMobileSub = { field: ChampionDesktopField; labelKey: string }

const subLabel = (f: ChampionDesktopField, fallback: string): string =>
  (SUB_ORDER as string[]).includes(f) || f === 'avgDamageSelfMitigated'
    ? `statisticsPage.championMobileSub_${f}`
    : fallback

/** 3 sous-stats : en mode « tout » un panachage, sinon les autres colonnes du groupe affiché. */
export function championMobileSubs(
  main: ChampionMobileField,
  mode: ChampionColumnMode = 'all'
): ChampionMobileSub[] {
  if (mode === 'all') {
    return SUB_ORDER.filter(f => f !== main)
      .slice(0, 3)
      .map(f => ({ field: f, labelKey: `statisticsPage.championMobileSub_${f}` }))
  }
  return CHAMPION_DESKTOP_COLUMNS.filter(c => c.group === mode && c.field !== main)
    .sort((a, b) => Number(a.detail) - Number(b.detail))
    .slice(0, 3)
    .map(c => ({ field: c.field, labelKey: subLabel(c.field, c.labelKey) }))
}

export function championMobileBarPct(value: number, max: number): number {
  if (!(max > 0)) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}
