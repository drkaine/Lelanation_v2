import { describe, expect, it } from 'vitest'
import { eventRankSnapshots } from '../../../../src/services/rankFromLeagueEntries.js'

const gameDate = new Date('2026-11-10T12:00:00Z')

describe('eventRankSnapshots', () => {
  it('ignores empty entries so they never override the DB snapshot', () => {
    const map = new Map([
      ['known', []],
      ['gold', [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 42 }]],
    ])
    const out = eventRankSnapshots(['known', 'gold', 'absent'], map as never, gameDate)
    expect([...out.keys()]).toEqual(['gold'])
    expect(out.get('gold')).toMatchObject({ rankTier: 'GOLD', rankLp: 42 })
  })
})
