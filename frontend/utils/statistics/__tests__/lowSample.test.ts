import { describe, expect, it } from 'vitest'
import { LOW_SAMPLE_MIN_GAMES, isLowSample, splitRareRows, adaptiveMinGames } from '../lowSample'

describe('isLowSample', () => {
  it('flags under 100 games', () => {
    expect(LOW_SAMPLE_MIN_GAMES).toBe(100)
    expect(isLowSample(2)).toBe(true)
    expect(isLowSample(99)).toBe(true)
    expect(isLowSample(100)).toBe(false)
  })
  it('treats missing or invalid counts as low', () => {
    expect(isLowSample(undefined)).toBe(true)
    expect(isLowSample('abc')).toBe(true)
    expect(isLowSample('250')).toBe(false)
  })
})

describe('splitRareRows', () => {
  const rows = [{ games: 500 }, { games: 11 }, { games: 120 }, { games: 16 }]
  it('cache les lignes sous le seuil', () => {
    const r = splitRareRows(rows, false)
    expect(r.rows.map(x => x.games)).toEqual([500, 120])
    expect(r.hidden).toBe(2)
  })
  it('les montre sur demande', () => {
    const r = splitRareRows(rows, true)
    expect(r.rows).toHaveLength(4)
    expect(r.hidden).toBe(2)
  })
  it('tout rare : on garde tout', () => {
    const r = splitRareRows([{ games: 3 }, { games: 5 }], false)
    expect(r.rows).toHaveLength(2)
    expect(r.hidden).toBe(0)
  })
})

describe('adaptiveMinGames', () => {
  it('garde 100 si assez de lignes, sinon divise par 2 jusqu’au plancher', () => {
    expect(adaptiveMinGames(Array(10).fill(150))).toBe(100)
    // 33 000 parties réparties sur ~40 adversaires × rôles : ~43 parties par ligne.
    expect(adaptiveMinGames([43, 45, 40, 30, 28, 26, 12, 8])).toBe(25)
    expect(adaptiveMinGames([5, 3])).toBe(10)
    expect(adaptiveMinGames([])).toBe(10)
  })
})
