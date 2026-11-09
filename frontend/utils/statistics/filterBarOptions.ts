/** Barre de filtres horizontale /statistics (maquette Redesign Statistiques). */
export type StatsOtpValue = 'non' | 'oui' | 'solo'

export const STATS_OTP_SEGMENTS: ReadonlyArray<{ value: StatsOtpValue; labelKey: string }> = [
  { value: 'non', labelKey: 'statisticsPage.filterBarOtpExcluded' },
  { value: 'oui', labelKey: 'statisticsPage.filterBarOtpIncluded' },
  { value: 'solo', labelKey: 'statisticsPage.filterBarOtpOnly' },
]

export type DivisionSummary =
  | { kind: 'all' }
  | { kind: 'one'; tier: string }
  | { kind: 'many'; count: number }

/** Libellé compact du sélecteur de divisions : « Toutes », un nom, ou « N divisions ». */
export function divisionSummary(selected: readonly string[]): DivisionSummary {
  if (selected.length === 0) return { kind: 'all' }
  if (selected.length === 1) return { kind: 'one', tier: selected[0]! }
  return { kind: 'many', count: selected.length }
}
