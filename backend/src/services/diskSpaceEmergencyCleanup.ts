/**
 * Nettoyage d'urgence disque (≥ 95 %) :
 * - vide `match_aggregated` (les matchs pourront être ré-agrégés par le batch)
 * - supprime `player_rank_history` plus vieux que 24 h (cutoff date)
 */

export const DISK_EMERGENCY_CLEANUP_THRESHOLD = 95
export const DISK_EMERGENCY_RANK_HISTORY_HOURS = 24

export type DiskEmergencyCleanupResult = {
  skipped: boolean
  skipReason?: string
  deletedMatchAggregated: number
  deletedRankHistory: number
  rankHistoryCutoffDate: string
}

export function rankHistoryCutoffDateForAgeHours(
  ageHours: number,
  nowMs: number = Date.now()
): string {
  const safeHours = Number.isFinite(ageHours) && ageHours > 0 ? ageHours : DISK_EMERGENCY_RANK_HISTORY_HOURS
  return new Date(nowMs - safeHours * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function shouldRunDiskEmergencyCleanup(options: {
  usagePercent: number
  alertThreshold: number | null
  lastCleanupAtThreshold: number
}): boolean {
  if (options.usagePercent < DISK_EMERGENCY_CLEANUP_THRESHOLD) return false
  const threshold = options.alertThreshold ?? null
  if (threshold == null || threshold < DISK_EMERGENCY_CLEANUP_THRESHOLD) return false
  return threshold > Math.max(0, options.lastCleanupAtThreshold)
}

export async function runDiskEmergencyCleanup(options?: {
  rankHistoryMaxAgeHours?: number
}): Promise<DiskEmergencyCleanupResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      skipped: true,
      skipReason: 'database_not_configured',
      deletedMatchAggregated: 0,
      deletedRankHistory: 0,
      rankHistoryCutoffDate: '',
    }
  }

  const { sql } = await import('../db/client.js')

  const ageHours =
    options?.rankHistoryMaxAgeHours ??
    Number(process.env.DISK_EMERGENCY_RANK_HISTORY_HOURS ?? String(DISK_EMERGENCY_RANK_HISTORY_HOURS))
  const cutoffDate = rankHistoryCutoffDateForAgeHours(ageHours)

  const matchRows = await sql<Array<{ n: number }>>`
    WITH deleted AS (
      DELETE FROM match_aggregated
      RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM deleted
  `

  const rankResult = await sql`
    DELETE FROM player_rank_history
    WHERE date < ${cutoffDate}::date
  `

  return {
    skipped: false,
    deletedMatchAggregated: Number(matchRows[0]?.n ?? 0),
    deletedRankHistory: rankResult.count,
    rankHistoryCutoffDate: cutoffDate,
  }
}
