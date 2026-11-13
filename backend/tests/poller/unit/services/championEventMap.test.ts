import { describe, expect, it } from 'vitest'
import {
  eventMapGameLimit,
  samplePoints,
  buildChampionEventMap,
  classifyKill,
} from '../../../../src/services/championEventMap.js'

const MIN = 60_000
// Repères carte (cf. getLaneZone) : top (2000, 12000), bot (12000, 2000), mid (7400, 7400), jungle (3800, 7800).
const TOP = { x: 2000, y: 12000 }
const BOT = { x: 12000, y: 2000 }
const MID = { x: 7400, y: 7400 }
const JGL = { x: 3800, y: 7800 }

describe('classifyKill', () => {
  it('jungler killing in a lane before 20 min = gank', () => {
    expect(classifyKill({ position: TOP, timestamp_ms: 5 * MIN }, 'JUNGLE')).toBe('gank')
  })
  it('kill inside the jungle = jungle', () => {
    expect(classifyKill({ position: JGL, timestamp_ms: 5 * MIN }, 'JUNGLE')).toBe('jungle')
    expect(classifyKill({ position: JGL, timestamp_ms: 5 * MIN }, 'MIDDLE')).toBe('jungle')
  })
  it('laner killing in another lane before 20 min = roam', () => {
    expect(classifyKill({ position: BOT, timestamp_ms: 8 * MIN }, 'MIDDLE')).toBe('roam')
    expect(classifyKill({ position: MID, timestamp_ms: 8 * MIN }, 'UTILITY')).toBe('roam')
  })
  it('laner killing in own lane = lane (support counts as bot)', () => {
    expect(classifyKill({ position: MID, timestamp_ms: 3 * MIN }, 'MIDDLE')).toBe('lane')
    expect(classifyKill({ position: BOT, timestamp_ms: 3 * MIN }, 'UTILITY')).toBe('lane')
  })
  it('any kill from 20 min = late', () => {
    expect(classifyKill({ position: TOP, timestamp_ms: 20 * MIN }, 'JUNGLE')).toBe('late')
  })
})

describe('buildChampionEventMap', () => {
  it('maps histories to compact points [x, y, seconds] and skips unknown positions', () => {
    const map = buildChampionEventMap([
      {
        team_position: 'JUNGLE',
        kill_history: [
          { kill_who: 3, timestamp_ms: 5 * MIN, position: TOP },
          { kill_who: 4, timestamp_ms: 6 * MIN, position: { x: 0, y: 0 } },
        ],
        death_history: [{ death_by: 7, timestamp_ms: 90_500, position: JGL }],
        ward_history: [
          { ward_type: 'CONTROL_WARD', timestamp_ms: 61_000, position: MID },
          { ward_type: 'YELLOW_TRINKET', timestamp_ms: 2 * MIN, position: BOT },
        ],
        ward_killed_history: [{ ward_type: 'SIGHT_WARD', timestamp_ms: 4 * MIN, position: JGL }],
      },
      { team_position: 'JUNGLE', kill_history: null, death_history: 'bad', ward_history: [] },
    ])
    expect(map.games).toBe(2)
    expect(map.kills).toEqual([[2000, 12000, 300, 'gank']])
    expect(map.deaths).toEqual([[3800, 7800, 90]])
    expect(map.wardsPlaced).toEqual([
      [7400, 7400, 61, 'control'],
      [12000, 2000, 120, 'trinket'],
    ])
    expect(map.wardsKilled).toEqual([[3800, 7800, 240, 'ward']])
  })

  it('normalizes ward types (blue trinket, unknown)', () => {
    const map = buildChampionEventMap([
      {
        team_position: 'UTILITY',
        ward_history: [
          { ward_type: 'BLUE_TRINKET', timestamp_ms: MIN, position: MID },
          { ward_type: 'UNDEFINED', timestamp_ms: MIN, position: MID },
        ],
      },
    ])
    expect(map.wardsPlaced.map(p => p[3])).toEqual(['farsight', 'ward'])
  })
})

describe('eventMapGameLimit', () => {
  it('returns null (all games) when no limit is asked', () => {
    expect(eventMapGameLimit(null)).toBeNull()
    expect(eventMapGameLimit(undefined)).toBeNull()
  })
  it('clamps an explicit limit to 1..20000', () => {
    expect(eventMapGameLimit(0)).toBe(1)
    expect(eventMapGameLimit(500)).toBe(500)
    expect(eventMapGameLimit(999_999)).toBe(20_000)
  })
})

describe('samplePoints', () => {
  it('keeps everything under the cap', () => {
    expect(samplePoints([1, 2, 3], 5)).toEqual([1, 2, 3])
  })
  it('keeps an evenly spread subset of max size', () => {
    const out = samplePoints(Array.from({ length: 100 }, (_, i) => i), 10)
    expect(out).toHaveLength(10)
    expect(out[0]).toBe(0)
    expect(out[9]).toBe(90)
  })
})
