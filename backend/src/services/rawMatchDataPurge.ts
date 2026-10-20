/**
 * Purge des données brutes de match plus vieilles qu'une date (admin) :
 * - `matchs` (cascade `participants`, `teams`) où `game_date < cutoff`
 * - `player_rank_history` où `date < cutoff`
 * Les agrégats et `match_aggregated` ne sont pas touchés : un match purgé puis
 * re-téléchargé n'est pas ré-agrégé.
 * Suppression par lots + CHECKPOINT pour borner le WAL (disque plein).
 * `compact` : VACUUM FULL pour rendre l'espace au système (verrou exclusif).
 */

export const RAW_MATCH_PURGE_DEFAULT_BATCH = 1000
const COMPACT_ORDER = ['matchs', 'teams', 'player_rank_history', 'participants'] as const

export type RawMatchDataPurgeOptions = {
  cutoffDate: string
  batchSize: number
  compact: boolean
}

export type RawMatchDataPurgeResult = {
  deletedMatches: number
  deletedRankHistory: number
  compactedTables: string[]
}

export type RawMatchDataPurgeProgress = {
  phase: 'matches' | 'rank_history' | 'compact'
  deletedMatches: number
  deletedRankHistory: number
}

export type RawMatchDataPurgeOps = {
  deleteMatchBatch(cutoffDate: string, size: number): Promise<number>
  deleteRankHistoryBatch(cutoffDate: string, size: number): Promise<number>
  checkpoint(): Promise<void>
  vacuumFull(table: string): Promise<void>
}

export function parsePurgeCutoffDate(
  input: unknown,
  nowMs: number = Date.now()
): { ok: true; date: string } | { ok: false; error: string } {
  if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return { ok: false, error: 'Date attendue au format YYYY-MM-DD' }
  }
  const ms = Date.parse(`${input}T00:00:00Z`)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== input) {
    return { ok: false, error: 'Date invalide' }
  }
  if (ms > nowMs) return { ok: false, error: 'Date dans le futur' }
  return { ok: true, date: input }
}

export async function runRawMatchDataPurge(
  ops: RawMatchDataPurgeOps,
  options: RawMatchDataPurgeOptions,
  onProgress?: (progress: RawMatchDataPurgeProgress) => void
): Promise<RawMatchDataPurgeResult> {
  const progress: RawMatchDataPurgeProgress = { phase: 'matches', deletedMatches: 0, deletedRankHistory: 0 }

  for (;;) {
    const n = await ops.deleteMatchBatch(options.cutoffDate, options.batchSize)
    if (n === 0) break
    progress.deletedMatches += n
    onProgress?.(progress)
    await ops.checkpoint()
  }

  progress.phase = 'rank_history'
  for (;;) {
    const n = await ops.deleteRankHistoryBatch(options.cutoffDate, options.batchSize)
    if (n === 0) break
    progress.deletedRankHistory += n
    onProgress?.(progress)
    await ops.checkpoint()
  }

  const compactedTables: string[] = []
  if (options.compact) {
    progress.phase = 'compact'
    for (const table of COMPACT_ORDER) {
      onProgress?.(progress)
      await ops.vacuumFull(table)
      compactedTables.push(table)
    }
  }

  return {
    deletedMatches: progress.deletedMatches,
    deletedRankHistory: progress.deletedRankHistory,
    compactedTables,
  }
}

export type RawMatchDataPurgeStatus = {
  state: 'idle' | 'running' | 'done' | 'error'
  cutoffDate?: string
  compact?: boolean
  startedAt?: string
  finishedAt?: string
  progress?: RawMatchDataPurgeProgress
  result?: RawMatchDataPurgeResult
  error?: string
}

/** Un seul job à la fois, état en mémoire (process backend). */
export function createRawMatchDataPurgeJob(getOps: () => RawMatchDataPurgeOps | Promise<RawMatchDataPurgeOps>) {
  let status: RawMatchDataPurgeStatus = { state: 'idle' }
  let current: Promise<void> = Promise.resolve()

  return {
    status: (): RawMatchDataPurgeStatus => ({ ...status, progress: status.progress && { ...status.progress } }),
    wait: () => current,
    start(options: RawMatchDataPurgeOptions): { started: boolean } {
      if (status.state === 'running') return { started: false }
      status = {
        state: 'running',
        cutoffDate: options.cutoffDate,
        compact: options.compact,
        startedAt: new Date().toISOString(),
      }
      current = (async () => {
        try {
          const ops = await getOps()
          const result = await runRawMatchDataPurge(ops, options, (p) => {
            status.progress = { ...p }
          })
          status = { ...status, state: 'done', result, finishedAt: new Date().toISOString() }
        } catch (err) {
          status = {
            ...status,
            state: 'error',
            error: err instanceof Error ? err.message : String(err),
            finishedAt: new Date().toISOString(),
          }
        }
      })()
      return { started: true }
    },
  }
}

export async function createPostgresRawMatchDataPurgeOps(): Promise<RawMatchDataPurgeOps> {
  const { sql } = await import('../db/client.js')
  return {
    async deleteMatchBatch(cutoffDate, size) {
      const res = await sql`
        DELETE FROM matchs
        WHERE riot_match_id IN (
          SELECT riot_match_id FROM matchs WHERE game_date < ${cutoffDate}::date LIMIT ${size}
        )
      `
      return res.count
    },
    async deleteRankHistoryBatch(cutoffDate, size) {
      const res = await sql`
        DELETE FROM player_rank_history
        WHERE ctid = ANY(ARRAY(
          SELECT ctid FROM player_rank_history WHERE date < ${cutoffDate}::date LIMIT ${size}
        ))
      `
      return res.count
    },
    async checkpoint() {
      // CHECKPOINT exige un superutilisateur : sans droit, le WAL reste géré par Postgres.
      await sql`CHECKPOINT`.catch(() => undefined)
    },
    async vacuumFull(table) {
      if (!(COMPACT_ORDER as readonly string[]).includes(table)) throw new Error(`Table non autorisée : ${table}`)
      await sql.unsafe(`VACUUM (FULL, ANALYZE) ${table}`)
    },
  }
}

export async function previewRawMatchDataPurge(
  cutoffDate: string
): Promise<{ matchesToDelete: number; matchesKept: number; rankHistoryToDelete: number }> {
  const { sql } = await import('../db/client.js')
  const [m] = await sql<Array<{ old: number; kept: number }>>`
    SELECT COUNT(*) FILTER (WHERE game_date < ${cutoffDate}::date)::int AS old,
           COUNT(*) FILTER (WHERE game_date >= ${cutoffDate}::date)::int AS kept
    FROM matchs
  `
  const [r] = await sql<Array<{ old: number }>>`
    SELECT COUNT(*)::int AS old FROM player_rank_history WHERE date < ${cutoffDate}::date
  `
  return { matchesToDelete: m?.old ?? 0, matchesKept: m?.kept ?? 0, rankHistoryToDelete: r?.old ?? 0 }
}

export const rawMatchDataPurgeJob = createRawMatchDataPurgeJob(createPostgresRawMatchDataPurgeOps)
