/**
 * Filtres cohorte (division, rôle, OTP) visibles par onglet — aligné sur statistics/index.vue (panneau filtres).
 * Les valeurs restent en mémoire entre onglets ; seules les requêtes / l’URL de l’onglet actif les appliquent.
 */

export type StatisticsCohortTab =
  | 'overview'
  | 'team'
  | 'objectives'
  | 'surrender'
  | 'bans'
  | 'championTable'
  | 'balance'
  | 'runes'
  | 'items'
  | 'spells'
  | 'infos'
  | 'pings'
  | 'vision'
  | 'patchNotes'
  | 'duration'
  | 'abandons'
  | 'champions'
  | 'progressions'
  | 'sides'
  | 'detail'
  | string

export type StatisticsOtpFilter = 'oui' | 'non' | 'solo'

export interface StatisticsCohortFilterValues {
  division: readonly string[]
  role: string
  otp: StatisticsOtpFilter
}

export interface StatisticsTabFilterFlags {
  division: boolean
  role: boolean
  otp: boolean
  championSearch: boolean
}

/** Miroir des v-if / v-show du panneau « Filtres » sur /statistics. */
export function statisticsTabFilterFlags(tab: StatisticsCohortTab): StatisticsTabFilterFlags {
  const t = tab
  return {
    division: t !== 'balance' && t !== 'surrender' && t !== 'infos' && t !== 'patchNotes',
    role: t !== 'objectives' && t !== 'surrender' && t !== 'infos' && t !== 'patchNotes',
    otp:
      t !== 'bans' &&
      t !== 'objectives' &&
      t !== 'surrender' &&
      t !== 'infos' &&
      t !== 'patchNotes',
    championSearch:
      t !== 'overview' &&
      t !== 'team' &&
      t !== 'objectives' &&
      t !== 'surrender' &&
      t !== 'infos' &&
      t !== 'patchNotes',
  }
}

export function statisticsTabUsesDivision(tab: StatisticsCohortTab): boolean {
  return statisticsTabFilterFlags(tab).division
}

export function statisticsTabUsesRole(tab: StatisticsCohortTab): boolean {
  return statisticsTabFilterFlags(tab).role
}

export function statisticsTabUsesOtp(tab: StatisticsCohortTab): boolean {
  return statisticsTabFilterFlags(tab).otp
}

export function statisticsTabUsesChampionSearch(tab: StatisticsCohortTab): boolean {
  return statisticsTabFilterFlags(tab).championSearch
}

/** Ajoute rankTier / role / otp selon l’onglet actif. */
export function appendStatisticsCohortParams(
  params: URLSearchParams,
  tab: StatisticsCohortTab,
  filters: StatisticsCohortFilterValues,
  opts?: { alwaysSendOtp?: boolean }
): void {
  const flags = statisticsTabFilterFlags(tab)
  if (flags.division) {
    for (const tier of filters.division) {
      if (tier) params.append('rankTier', tier)
    }
  }
  if (flags.role && filters.role.trim()) {
    params.set('role', filters.role.trim())
  }
  if (flags.otp) {
    if (opts?.alwaysSendOtp || filters.otp !== 'non') {
      params.set('otp', filters.otp)
    }
  }
}

export function cohortFiltersForTab(
  tab: StatisticsCohortTab,
  filters: StatisticsCohortFilterValues
): StatisticsCohortFilterValues {
  const flags = statisticsTabFilterFlags(tab)
  return {
    division: flags.division ? [...filters.division] : [],
    role: flags.role ? filters.role : '',
    otp: flags.otp ? filters.otp : 'oui',
  }
}
