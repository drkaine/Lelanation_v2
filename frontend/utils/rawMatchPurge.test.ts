import { describe, expect, it } from 'vitest'
import { defaultPurgeCutoffDate, purgeConfirmMessage, purgeProgressLabel } from './rawMatchPurge'

describe('rawMatchPurge', () => {
  it('defaults to the first day of the current UTC month', () => {
    expect(defaultPurgeCutoffDate(new Date('2026-10-20T12:00:00Z'))).toBe('2026-10-01')
    expect(defaultPurgeCutoffDate(new Date('2026-01-01T00:30:00Z'))).toBe('2026-01-01')
  })

  it('builds a confirmation message with the counts to delete', () => {
    const msg = purgeConfirmMessage('2026-10-01', {
      matchesToDelete: 350000,
      matchesKept: 58000,
      rankHistoryToDelete: 3000000,
    })
    expect(msg).toContain('2026-10-01')
    expect(msg).toContain('350')
    expect(msg).toContain('58')
    expect(msg).toContain('3')
  })

  it('labels the job progress', () => {
    expect(purgeProgressLabel({ state: 'idle' })).toBe('Aucune purge lancée')
    expect(
      purgeProgressLabel({
        state: 'running',
        progress: { phase: 'matches', deletedMatches: 1200, deletedRankHistory: 0 },
      })
    ).toMatch(/matchs.*1/)
    expect(purgeProgressLabel({ state: 'error', error: 'disk full' })).toContain('disk full')
  })
})
