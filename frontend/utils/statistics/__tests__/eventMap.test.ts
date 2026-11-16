import { describe, expect, it } from 'vitest'
import {
  DEATH_KINDS,
  EVENT_MAP_LAYERS,
  KILL_KINDS,
  eventMapDots,
  phaseOf,
  toMapPct,
  type EventMapApi,
} from '../eventMap'

const api: EventMapApi = {
  games: 2,
  kills: [
    [1500, 13500, 300, 'gank'],
    [7500, 7500, 900, 'roam'],
    [7500, 7500, 1500, 'late'],
    [10504, 1200, 400, 'dive'],
  ],
  deaths: [
    [3000, 3000, 200, 'solo'],
    [3000, 3000, 1000, 'gank'],
    [3000, 3000, 1600, 'other'],
  ],
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
  it('kills layer: kills only, with their context', () => {
    const dots = eventMapDots(api, 'kills', { phase: 'all', kinds: null })
    expect(dots.map(d => d.kind)).toEqual(['gank', 'roam', 'late', 'dive'])
    expect(dots[0]).toMatchObject({ x: 10, y: 10 })
  })
  it('deaths layer: deaths only, with their context', () => {
    expect(eventMapDots(api, 'deaths', { phase: 'all', kinds: null }).map(d => d.kind)).toEqual([
      'solo',
      'gank',
      'other',
    ])
  })
  it('filters by kinds and phase', () => {
    expect(
      eventMapDots(api, 'kills', { phase: 'early', kinds: ['gank', 'dive'] }).map(d => d.kind)
    ).toEqual(['gank', 'dive'])
    expect(eventMapDots(api, 'deaths', { phase: 'mid', kinds: ['gank'] }).map(d => d.kind)).toEqual(
      ['gank']
    )
  })
  it('lists the categories of each map', () => {
    expect(KILL_KINDS).toEqual(['gank', 'roam', 'dive', 'lane', 'jungle', 'late'])
    expect(DEATH_KINDS).toEqual(['dive', 'gank', 'roam', 'solo', 'fight', 'other'])
    expect(EVENT_MAP_LAYERS).toEqual(['kills', 'deaths', 'vision'])
  })
  it('vision layer: placed wards by type, destroyed wards as "killed"', () => {
    expect(eventMapDots(api, 'vision', { phase: 'all', kinds: null }).map(d => d.kind)).toEqual([
      'trinket',
      'control',
      'killed',
    ])
  })
  it('returns [] without data', () => {
    expect(eventMapDots(null, 'kills', { phase: 'all', kinds: null })).toEqual([])
  })
})

describe('eventMapZones', () => {
  it('regroupe par zone : position moyenne, total, catégorie dominante, part', async () => {
    const { eventMapZones } = await import('../eventMap')
    const zones = eventMapZones(
      [
        { x: 1, y: 1, kind: 'gank' },
        { x: 3, y: 3, kind: 'gank' },
        { x: 4, y: 2, kind: 'other' },
        { x: 90, y: 90, kind: 'other' },
      ],
      10
    )
    expect(zones).toHaveLength(2)
    const big = zones.find(z => z.count === 3)!
    expect(big).toMatchObject({ x: 2.7, y: 2, kind: 'gank', pct: 75, r: 1 })
    expect(zones.find(z => z.count === 1)).toMatchObject({ x: 90, y: 90, kind: 'other', pct: 25 })
    expect(zones[zones.length - 1]!.count).toBe(3)
  })
  it('renvoie [] sans points', async () => {
    const { eventMapZones } = await import('../eventMap')
    expect(eventMapZones([], 10)).toEqual([])
  })
})
