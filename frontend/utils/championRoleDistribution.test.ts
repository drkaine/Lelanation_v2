import { describe, expect, it } from 'vitest'
import {
  buildChampionRoleDistribution,
  championRoleDistributionSorted,
  formatChampionRolePercent,
} from './championRoleDistribution'

describe('buildChampionRoleDistribution', () => {
  it('computes pickrate from games across all roles', () => {
    const rows = buildChampionRoleDistribution({
      TOP: { games: 30, wins: 15, winrate: 50 },
      JUNGLE: { games: 70, wins: 35, winrate: 50 },
    })
    const top = rows.find(r => r.role === 'TOP')
    const jungle = rows.find(r => r.role === 'JUNGLE')
    expect(top?.pickrate).toBe(30)
    expect(jungle?.pickrate).toBe(70)
  })

  it('maps MID and ADC API keys to MIDDLE and BOTTOM', () => {
    const rows = buildChampionRoleDistribution({
      TOP: { games: 10, wins: 5 },
      MID: { games: 20, wins: 10 },
      ADC: { games: 70, wins: 35 },
    })
    const top = rows.find(r => r.role === 'TOP')
    const mid = rows.find(r => r.role === 'MIDDLE')
    const adc = rows.find(r => r.role === 'BOTTOM')
    expect(top?.pickrate).toBe(10)
    expect(mid?.pickrate).toBe(20)
    expect(adc?.pickrate).toBe(70)
    expect(mid?.games).toBe(20)
    expect(adc?.games).toBe(70)
  })

  it('does not double-count duplicate MID and MIDDLE keys', () => {
    const rows = buildChampionRoleDistribution({
      MID: { games: 1000, wins: 500, winrate: 50 },
      MIDDLE: { games: 1000, wins: 500, winrate: 50 },
      ADC: { games: 100, wins: 50, winrate: 50 },
      BOTTOM: { games: 100, wins: 50, winrate: 50 },
    })
    const mid = rows.find(r => r.role === 'MIDDLE')
    const adc = rows.find(r => r.role === 'BOTTOM')
    expect(mid?.games).toBe(1000)
    expect(adc?.games).toBe(100)
    expect(mid?.pickrate).toBeCloseTo(90.909, 2)
    expect(mid?.winrate).toBe(50)
    expect(adc?.winrate).toBe(50)
    const totalPick = rows.reduce((s, r) => s + r.pickrate, 0)
    expect(totalPick).toBeCloseTo(100, 1)
  })

  it('clamps winrate and pickrate to 0-100', () => {
    const rows = buildChampionRoleDistribution({
      ADC: { games: 100, wins: 150, winrate: 150 },
    })
    const adc = rows.find(r => r.role === 'BOTTOM')
    expect(adc?.winrate).toBe(100)
    expect(adc?.pickrate).toBe(100)
  })
})

describe('championRoleDistributionSorted', () => {
  it('filters zero-game roles and sorts by games desc', () => {
    const rows = championRoleDistributionSorted(
      {
        TOP: { games: 10 },
        MIDDLE: { games: 40 },
        BOTTOM: { games: 0 },
      },
      { minGames: 1 }
    )
    expect(rows.map(r => r.role)).toEqual(['MIDDLE', 'TOP'])
  })
})

describe('formatChampionRolePercent', () => {
  it('formats with two decimals', () => {
    expect(formatChampionRolePercent(12.3456)).toBe('12.35')
  })
})
