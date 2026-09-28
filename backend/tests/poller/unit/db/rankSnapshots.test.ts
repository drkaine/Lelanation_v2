import { describe, expect, it } from 'vitest'
import { rankSnapshotsByPuuid } from '../../../../src/db/query.js'

describe('rankSnapshotsByPuuid', () => {
  it('normalizes tier / division / LP and keys by puuid', () => {
    const date = new Date('2026-09-01T00:00:00Z')
    const map = rankSnapshotsByPuuid([
      { puuid: 'a', rank_tier: ' gold ', rank_division: 'II ', rank_lp: 42, date },
      { puuid: 'b', rank_tier: null, rank_division: null, rank_lp: null, date: '2026-09-02' as unknown as Date },
    ])
    expect(map.get('a')).toEqual({ rankTier: 'GOLD', rankDivision: 'II', rankLp: 42, date })
    expect(map.get('b')).toEqual({
      rankTier: 'UNRANKED',
      rankDivision: '',
      rankLp: 0,
      date: new Date('2026-09-02'),
    })
  })
})
