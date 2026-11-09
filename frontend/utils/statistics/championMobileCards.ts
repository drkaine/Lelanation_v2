/** Cartes mobiles de l'onglet Champions (maquette 11) : valeur principale + 3 sous-stats + KDA. */
export type ChampionMobileField =
  | 'avgDamageToChamps'
  | 'avgDamageTakenTotal'
  | 'avgTotalHeal'
  | 'avgDamageSelfMitigated'
  | 'avgTimeCcDealt'

export const CHAMPION_MOBILE_METRICS: ReadonlyArray<{
  sort: string
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

export function championMobileMetric(sortColumn: string): ChampionMobileField {
  const base = sortColumn.replace(/Delta$/, '')
  return CHAMPION_MOBILE_METRICS.find(m => m.sort === base)?.field ?? 'avgDamageToChamps'
}

export function championMobileSubs(main: ChampionMobileField): ChampionMobileField[] {
  return SUB_ORDER.filter(f => f !== main).slice(0, 3)
}

export function championMobileBarPct(value: number, max: number): number {
  if (!(max > 0)) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}
