import { describe, expect, it } from 'vitest'
import {
  createRawMatchDataPurgeJob,
  parsePurgeCutoffDate,
  runRawMatchDataPurge,
  type RawMatchDataPurgeOps,
  type RawTable,
} from '../../../../src/services/rawMatchDataPurge.js'

const NOW = Date.parse('2026-10-20T12:00:00Z')

function fakeOps(counts: Partial<Record<RawTable, { kept: number; total: number }>> = {}, deletedMatches = 0) {
  const calls: string[] = []
  const ops: RawMatchDataPurgeOps = {
    async stopPoller() {
      calls.push('stopPoller')
    },
    async startPoller() {
      calls.push('startPoller')
    },
    async exportKept(table, cutoff) {
      calls.push(`export:${table}:${cutoff}`)
      return counts[table] ?? { kept: 0, total: 0 }
    },
    async truncate(tables) {
      calls.push(`truncate:${tables.join(',')}`)
    },
    async deleteOldMatches(cutoff) {
      calls.push(`deleteMatches:${cutoff}`)
      return deletedMatches
    },
    async importKept(table) {
      calls.push(`import:${table}`)
    },
    async cleanup() {
      calls.push('cleanup')
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
  it('stops the poller, exports kept rows, truncates, reloads, then restarts the poller', async () => {
    const { ops, calls } = fakeOps({ player_rank_history: { kept: 7, total: 10 } }, 4)
    const result = await runRawMatchDataPurge(ops, { cutoffDate: '2026-10-01' })

    expect(result).toEqual({ deletedMatches: 4, deletedRankHistory: 3 })
    expect(calls).toEqual([
      'stopPoller',
      'export:player_rank_history:2026-10-01',
      'truncate:player_rank_history',
      'import:player_rank_history',
      'export:teams:2026-10-01',
      'export:participants:2026-10-01',
      'truncate:participants,teams',
      'deleteMatches:2026-10-01',
      'import:teams',
      'import:participants',
      'cleanup',
      'startPoller',
    ])
  })

  it('reports each phase', async () => {
    const { ops } = fakeOps({ player_rank_history: { kept: 1, total: 3 } }, 5)
    const seen: string[] = []
    await runRawMatchDataPurge(ops, { cutoffDate: '2026-10-01' }, (p) => seen.push(p.phase))
    expect(seen).toEqual(['stop_poller', 'rank_history', 'matches', 'start_poller'])
  })

  it('restarts the poller when it fails before any truncate', async () => {
    const { ops, calls } = fakeOps()
    ops.exportKept = async () => {
      throw new Error('disk full')
    }
    await expect(runRawMatchDataPurge(ops, { cutoffDate: '2026-10-01' })).rejects.toThrow('disk full')
    expect(calls).toContain('startPoller')
    expect(calls).toContain('cleanup')
  })

  it('keeps the poller stopped and the export files after a truncate when import fails', async () => {
    const { ops, calls } = fakeOps()
    ops.importKept = async () => {
      throw new Error('import failed')
    }
    await expect(runRawMatchDataPurge(ops, { cutoffDate: '2026-10-01' })).rejects.toThrow('import failed')
    expect(calls).not.toContain('startPoller')
    expect(calls).not.toContain('cleanup')
  })
})

describe('createRawMatchDataPurgeJob', () => {
  it('refuses a second run while one is in progress, then exposes the result', async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { ops } = fakeOps({}, 1)
    const slowOps: RawMatchDataPurgeOps = {
      ...ops,
      async stopPoller() {
        await gate
      },
    }
    const job = createRawMatchDataPurgeJob(() => slowOps)
    const opts = { cutoffDate: '2026-10-01' }

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
    const { ops } = fakeOps()
    const job = createRawMatchDataPurgeJob(() => ({
      ...ops,
      async stopPoller() {
        throw new Error('pm2 missing')
      },
    }))
    job.start({ cutoffDate: '2026-10-01' })
    await job.wait()
    expect(job.status()).toMatchObject({ state: 'error', error: 'pm2 missing' })
  })
})
