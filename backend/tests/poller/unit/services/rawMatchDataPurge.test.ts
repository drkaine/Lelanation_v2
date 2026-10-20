import { describe, expect, it } from 'vitest'
import {
  createRawMatchDataPurgeJob,
  parsePurgeCutoffDate,
  runRawMatchDataPurge,
  type RawMatchDataPurgeOps,
} from '../../../../src/services/rawMatchDataPurge.js'

const NOW = Date.parse('2026-10-20T12:00:00Z')

function fakeOps(matchBatches: number[], rankBatches: number[]) {
  const calls: string[] = []
  const ops: RawMatchDataPurgeOps = {
    async deleteMatchBatch(cutoff, size) {
      calls.push(`match:${cutoff}:${size}`)
      return matchBatches.shift() ?? 0
    },
    async deleteRankHistoryBatch(cutoff, size) {
      calls.push(`rank:${cutoff}:${size}`)
      return rankBatches.shift() ?? 0
    },
    async checkpoint() {
      calls.push('checkpoint')
    },
    async vacuumFull(table) {
      calls.push(`vacuum:${table}`)
    },
  }
  return { ops, calls }
}

describe('parsePurgeCutoffDate', () => {
  it('accepts a past YYYY-MM-DD date', () => {
    expect(parsePurgeCutoffDate('2026-10-01', NOW)).toEqual({ ok: true, date: '2026-10-01' })
  })

  it('rejects malformed, impossible or future dates', () => {
    expect(parsePurgeCutoffDate('01/10/2026', NOW).ok).toBe(false)
    expect(parsePurgeCutoffDate('2026-02-30', NOW).ok).toBe(false)
    expect(parsePurgeCutoffDate('2026-10-21', NOW).ok).toBe(false)
    expect(parsePurgeCutoffDate(undefined, NOW).ok).toBe(false)
  })
})

describe('runRawMatchDataPurge', () => {
  it('deletes matches then rank history in batches until empty, checkpointing each batch', async () => {
    const { ops, calls } = fakeOps([2, 1, 0], [3, 0])
    const result = await runRawMatchDataPurge(ops, { cutoffDate: '2026-10-01', batchSize: 2, compact: false })

    expect(result).toEqual({ deletedMatches: 3, deletedRankHistory: 3, compactedTables: [] })
    expect(calls).toEqual([
      'match:2026-10-01:2',
      'checkpoint',
      'match:2026-10-01:2',
      'checkpoint',
      'match:2026-10-01:2',
      'rank:2026-10-01:2',
      'checkpoint',
      'rank:2026-10-01:2',
    ])
  })

  it('compacts raw tables smallest first when asked', async () => {
    const { ops, calls } = fakeOps([], [])
    const result = await runRawMatchDataPurge(ops, { cutoffDate: '2026-10-01', batchSize: 10, compact: true })

    expect(result.compactedTables).toEqual(['matchs', 'teams', 'player_rank_history', 'participants'])
    expect(calls.filter((c) => c.startsWith('vacuum:'))).toEqual([
      'vacuum:matchs',
      'vacuum:teams',
      'vacuum:player_rank_history',
      'vacuum:participants',
    ])
  })

  it('reports progress after each batch', async () => {
    const { ops } = fakeOps([5, 0], [4, 0])
    const seen: Array<{ phase: string; deletedMatches: number; deletedRankHistory: number }> = []
    await runRawMatchDataPurge(ops, { cutoffDate: '2026-10-01', batchSize: 5, compact: false }, (p) =>
      seen.push({ ...p }),
    )
    expect(seen.at(-1)).toEqual({ phase: 'rank_history', deletedMatches: 5, deletedRankHistory: 4 })
  })
})

describe('createRawMatchDataPurgeJob', () => {
  it('refuses a second run while one is in progress, then exposes the result', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { ops } = fakeOps([1, 0], [0])
    const slowOps: RawMatchDataPurgeOps = {
      ...ops,
      async deleteMatchBatch(cutoff, size) {
        await gate
        return ops.deleteMatchBatch(cutoff, size)
      },
    }
    const job = createRawMatchDataPurgeJob(() => slowOps)
    const opts = { cutoffDate: '2026-10-01', batchSize: 1, compact: false }

    expect(job.start(opts).started).toBe(true)
    expect(job.start(opts).started).toBe(false)
    expect(job.status().state).toBe('running')

    release()
    await job.wait()
    expect(job.status()).toMatchObject({
      state: 'done',
      cutoffDate: '2026-10-01',
      result: { deletedMatches: 1, deletedRankHistory: 0 },
    })
  })

  it('stores the error when the purge fails', async () => {
    const { ops } = fakeOps([], [])
    const job = createRawMatchDataPurgeJob(() => ({
      ...ops,
      async deleteMatchBatch() {
        throw new Error('disk full')
      },
    }))
    job.start({ cutoffDate: '2026-10-01', batchSize: 1, compact: false })
    await job.wait()
    expect(job.status()).toMatchObject({ state: 'error', error: 'disk full' })
  })
})
