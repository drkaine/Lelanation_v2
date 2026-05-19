/**
 * @deprecated Patch close/archive removed — stats live in partitioned `lelanation_statistiques` tables.
 */

export function trackedMatchesCutoffDateFromReleaseDate(releaseDate: string, graceDays: number): Date {
  const d = new Date(releaseDate)
  d.setUTCDate(d.getUTCDate() + graceDays)
  return d
}

/** @deprecated No-op */
export async function closePatch(_patch: string): Promise<unknown> {
  return { ok: true, skipped: true }
}
