/** Délai minimum entre deux vérifications automatiques à la connexion. */
export const SURVEILLANCE_ALERT_CHECK_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000

export function shouldRunScheduledSurveillanceCheck(lastCheckedAt: string | null): boolean {
  if (!lastCheckedAt) return true
  const elapsed = Date.now() - new Date(lastCheckedAt).getTime()
  if (!Number.isFinite(elapsed)) return true
  return elapsed >= SURVEILLANCE_ALERT_CHECK_MIN_INTERVAL_MS
}
