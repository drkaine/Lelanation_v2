/** Puces « filtres actifs » de la barre mobile des statistiques (maquette Mobile). */
import type {
  StatisticsOtpFilter,
  StatisticsTabFilterFlags,
} from '~/composables/statistics/statisticsTabFilters'

export type StatsFilterChipKey = 'version' | 'division' | 'role' | 'otp' | 'search'

export interface StatsFilterChip {
  key: StatsFilterChipKey
  value: string
}

export function statsFilterChips(
  f: {
    version: string
    divisions: readonly string[]
    role: string
    otp: StatisticsOtpFilter
    search: string
  },
  flags: Pick<StatisticsTabFilterFlags, 'division' | 'role' | 'otp' | 'championSearch'>
): StatsFilterChip[] {
  const chips: StatsFilterChip[] = []
  if (f.version.trim()) chips.push({ key: 'version', value: f.version.trim() })
  if (flags.division && f.divisions.length)
    chips.push({ key: 'division', value: f.divisions.join(', ') })
  if (flags.role && f.role.trim()) chips.push({ key: 'role', value: f.role.trim() })
  if (flags.otp && f.otp !== 'non') chips.push({ key: 'otp', value: f.otp })
  if (flags.championSearch && f.search.trim()) chips.push({ key: 'search', value: f.search.trim() })
  return chips
}
