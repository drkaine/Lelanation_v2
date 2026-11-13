import { describe, expect, it } from 'vitest'
import { eventMapDots, phaseOf, toMapPct, type EventMapApi } from '../eventMap'

const api: EventMapApi = {
  games: 2,
  kills: [
    [1500, 13500, 300, 'gank'],
    [7500, 7500, 900, 'roam'],
    [7500, 7500, 1500, 'late'],
  ],
  deaths: [[3000, 3000, 200]],
  wardsPlaced: [
    [7500, 7500, 60, 'trinket'],
    [7500, 7500, 1000, 'control'],
  ],
  wardsKilled: [[7500, 7500, 1700, 'ward']],
}

describe('toMapPct', () => {
  it('projects Riot coords onto a 0–100 SVG box (y flipped)', () => {
    expect(toMapPct(1500, 13500)).toEqual({ x: 10, y: 10 })
    expect(toMapPct(0, 0)).toEqual({ x: 0, y: 100 })
  })
})

describe('phaseOf', () => {
  it('early < 14 min ≤ mid < 25 min ≤ late', () => {
    expect(phaseOf(839)).toBe('early')
    expect(phaseOf(840)).toBe('mid')
    expect(phaseOf(1500)).toBe('late')
  })
})

describe('eventMapDots', () => {
  it('combat layer: kills keep their kind, deaths become "death"', () => {
    const dots = eventMapDots(api, 'combat', { phase: 'all', kinds: null })
    expect(dots.map(d => d.kind)).toEqual(['gank', 'roam', 'late', 'death'])
    expect(dots[0]).toMatchObject({ x: 10, y: 10 })
  })
  it('filters by kinds and phase', () => {
    expect(
      eventMapDots(api, 'combat', { phase: 'early', kinds: ['gank', 'death'] }).map(d => d.kind)
    ).toEqual(['gank', 'death'])
  })
  it('vision layer: placed wards by type, destroyed wards as "killed"', () => {
    expect(eventMapDots(api, 'vision', { phase: 'all', kinds: null }).map(d => d.kind)).toEqual([
      'trinket',
      'control',
      'killed',
    ])
  })
  it('returns [] without data', () => {
    expect(eventMapDots(null, 'combat', { phase: 'all', kinds: null })).toEqual([])
  })
})
