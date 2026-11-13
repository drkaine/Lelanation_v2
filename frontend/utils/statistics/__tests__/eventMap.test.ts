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

describe('eventMapZones', () => {
  it('regroupe par zone : position moyenne, total, catégorie dominante, part', async () => {
    const { eventMapZones } = await import('../eventMap')
    const zones = eventMapZones(
      [
        { x: 1, y: 1, kind: 'gank' },
        { x: 3, y: 3, kind: 'gank' },
        { x: 4, y: 2, kind: 'death' },
        { x: 90, y: 90, kind: 'death' },
      ],
      10
    )
    expect(zones).toHaveLength(2)
    const big = zones.find(z => z.count === 3)!
    expect(big).toMatchObject({ x: 2.7, y: 2, kind: 'gank', pct: 75, r: 1 })
    expect(zones.find(z => z.count === 1)).toMatchObject({ x: 90, y: 90, kind: 'death', pct: 25 })
    expect(zones[zones.length - 1]!.count).toBe(3)
  })
  it('renvoie [] sans points', async () => {
    const { eventMapZones } = await import('../eventMap')
    expect(eventMapZones([], 10)).toEqual([])
  })
})
