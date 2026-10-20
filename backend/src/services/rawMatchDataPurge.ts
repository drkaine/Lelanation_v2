/**
 * Purge des données brutes de match plus vieilles qu'une date (admin) :
 * - `matchs`, `participants`, `teams` où `game_date < cutoff`
 * - `player_rank_history` où `date < cutoff`
 * Les agrégats et `match_aggregated` ne sont pas touchés : un match purgé puis
 * re-téléchargé n'est pas ré-agrégé.
 * Méthode rapide (DELETE par lots trop lent sur 22 Go) : poller arrêté, export
 * gzip des lignes gardées, TRUNCATE (rend l'espace disque), réimport.
 * Échec après un TRUNCATE : poller laissé arrêté, fichiers d'export conservés.
 */
import { exec } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { createGunzip, createGzip } from 'node:zlib'

const execAsync = promisify(exec)
const POLLER_PROCESS = 'lelanation-poller-v2'

export type RawTable = 'player_rank_history' | 'teams' | 'participants'

export type RawMatchDataPurgeOptions = {
  cutoffDate: string
}

export type RawMatchDataPurgeResult = {
  deletedMatches: number
  deletedRankHistory: number
}

export type RawMatchDataPurgeProgress = {
  phase: 'stop_poller' | 'rank_history' | 'matches' | 'start_poller'
  deletedMatches: number
  deletedRankHistory: number
}

export type RawMatchDataPurgeOps = {
  stopPoller(): Promise<void>
  startPoller(): Promise<void>
  /** Exporte les lignes gardées ; `total` = lignes de la table avant purge. */
  exportKept(table: RawTable, cutoffDate: string): Promise<{ kept: number; total: number }>
  truncate(tables: RawTable[]): Promise<void>
  deleteOldMatches(cutoffDate: string): Promise<number>
  importKept(table: RawTable): Promise<void>
  cleanup(): Promise<void>
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
  const progress: RawMatchDataPurgeProgress = { phase: 'stop_poller', deletedMatches: 0, deletedRankHistory: 0 }
  const step = (phase: RawMatchDataPurgeProgress['phase']) => {
    progress.phase = phase
    onProgress?.(progress)
  }
  let truncated = false

  try {
    step('stop_poller')
    await ops.stopPoller()

    step('rank_history')
    const rh = await ops.exportKept('player_rank_history', options.cutoffDate)
    truncated = true
    await ops.truncate(['player_rank_history'])
    await ops.importKept('player_rank_history')
    progress.deletedRankHistory = rh.total - rh.kept

    step('matches')
    await ops.exportKept('teams', options.cutoffDate)
    await ops.exportKept('participants', options.cutoffDate)
    await ops.truncate(['participants', 'teams'])
    progress.deletedMatches = await ops.deleteOldMatches(options.cutoffDate)
    await ops.importKept('teams')
    await ops.importKept('participants')
  } catch (err) {
    if (!truncated) {
      await ops.cleanup().catch(() => undefined)
      await ops.startPoller().catch(() => undefined)
    }
    throw err
  }

  await ops.cleanup()
  step('start_poller')
  await ops.startPoller()

  return { deletedMatches: progress.deletedMatches, deletedRankHistory: progress.deletedRankHistory }
}

export type RawMatchDataPurgeStatus = {
  state: 'idle' | 'running' | 'done' | 'error'
  cutoffDate?: string
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

/** Lignes gardées de chaque table (SQL fixe ; sert aussi de liste blanche des tables). */
const KEPT_QUERY: Record<RawTable, string> = {
  player_rank_history: 'SELECT * FROM player_rank_history WHERE date >= $1::date',
  teams: 'SELECT x.* FROM teams x JOIN matchs m USING (riot_match_id) WHERE m.game_date >= $1::date',
  participants:
    'SELECT x.* FROM participants x JOIN matchs m USING (riot_match_id) WHERE m.game_date >= $1::date',
}

function literalDate(cutoffDate: string): string {
  if (!parsePurgeCutoffDate(cutoffDate).ok) throw new Error(`Date invalide : ${cutoffDate}`)
  return `'${cutoffDate}'::date`
}

export async function createPostgresRawMatchDataPurgeOps(): Promise<RawMatchDataPurgeOps> {
  const { sql } = await import('../db/client.js')
  const dir = await mkdtemp(join(tmpdir(), 'lelanation-raw-purge-'))
  const file = (table: RawTable) => join(dir, `${table}.tsv.gz`)

  return {
    async stopPoller() {
      await execAsync(`pm2 stop ${POLLER_PROCESS}`, { timeout: 30_000 })
    },
    async startPoller() {
      await execAsync(`pm2 start ${POLLER_PROCESS}`, { timeout: 30_000 })
    },
    async exportKept(table, cutoffDate) {
      // COPY n'accepte pas de paramètres : date validée puis inlinée.
      const copy = KEPT_QUERY[table].replace('$1::date', literalDate(cutoffDate))
      const [{ kept }] = await sql.unsafe<Array<{ kept: number }>>(`SELECT COUNT(*)::int AS kept FROM (${copy}) k`)
      const [{ total }] = await sql.unsafe<Array<{ total: number }>>(`SELECT COUNT(*)::int AS total FROM ${table}`)
      const readable = await sql.unsafe(`COPY (${copy}) TO STDOUT`).readable()
      await pipeline(readable, createGzip({ level: 1 }), createWriteStream(file(table)))
      return { kept, total }
    },
    async truncate(tables) {
      if (tables.some((t) => !(t in KEPT_QUERY))) throw new Error(`Table non autorisée : ${tables.join(', ')}`)
      await sql.unsafe(`TRUNCATE ${tables.join(', ')}`)
    },
    async deleteOldMatches(cutoffDate) {
      const res = await sql`DELETE FROM matchs WHERE game_date < ${cutoffDate}::date`
      return res.count
    },
    async importKept(table) {
      const writable = await sql.unsafe(`COPY ${table} FROM STDIN`).writable()
      await pipeline(createReadStream(file(table)), createGunzip(), writable)
      await sql.unsafe(`ANALYZE ${table}`)
    },
    async cleanup() {
      await rm(dir, { recursive: true, force: true })
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
