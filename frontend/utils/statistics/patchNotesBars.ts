export type PatchNotesBarType = 'up' | 'nerf' | 'adjust'

/** Barre empilée buff / nerf / ajust, largeur relative au plus gros total affiché. */
export function patchNotesBarSegments(
  row: { countUp: number; countNerf: number; countAjust: number },
  maxTotal: number
): Array<{ type: PatchNotesBarType; pct: number }> {
  if (!(maxTotal > 0)) return []
  const parts: Array<[PatchNotesBarType, number]> = [
    ['up', row.countUp],
    ['nerf', row.countNerf],
    ['adjust', row.countAjust],
  ]
  return parts.filter(([, n]) => n > 0).map(([type, n]) => ({ type, pct: (n / maxTotal) * 100 }))
}

export const PATCH_NOTES_PERIODS = ['all', 'last3', 'last5', 'last10'] as const
export type PatchNotesPeriod = (typeof PATCH_NOTES_PERIODS)[number]

const PERIOD_SIZE: Record<Exclude<PatchNotesPeriod, 'all'>, number> = {
  last3: 3,
  last5: 5,
  last10: 10,
}

/** `versionsDesc` : versions triées de la plus récente à la plus ancienne. */
export function patchNotesPeriodRange(
  versionsDesc: readonly string[],
  period: PatchNotesPeriod
): { from: string; to: string } {
  if (period === 'all' || versionsDesc.length === 0) return { from: '', to: '' }
  const n = Math.min(PERIOD_SIZE[period], versionsDesc.length)
  return { from: versionsDesc[n - 1]!, to: versionsDesc[0]! }
}

export function patchNotesPeriodOf(
  versionsDesc: readonly string[],
  from: string,
  to: string
): PatchNotesPeriod | 'custom' {
  if (!from.trim() && !to.trim()) return 'all'
  for (const period of PATCH_NOTES_PERIODS) {
    if (period === 'all') continue
    const r = patchNotesPeriodRange(versionsDesc, period)
    if (r.from === from && r.to === to) return period
  }
  return 'custom'
}
