import { describe, expect, it } from 'vitest'
import {
  eventMapGameLimit,
  samplePoints,
  buildChampionEventMap,
  classifyKill,
  classifyDeath,
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

// Tours (Riot) : bleu bot outer (10504, 1029) ; rouge top outer (4318, 13875).
const BLUE_BOT_TOWER = { x: 10504, y: 1200 }
const RED_TOP_TOWER = { x: 4318, y: 13700 }

describe('classifyKill: dive', () => {
  it('kill near an enemy tower = dive (needs own team)', () => {
    expect(classifyKill({ position: RED_TOP_TOWER, timestamp_ms: 5 * MIN }, 'TOP', 100)).toBe('dive')
    expect(classifyKill({ position: RED_TOP_TOWER, timestamp_ms: 5 * MIN }, 'TOP', 200)).toBe('lane')
    expect(classifyKill({ position: RED_TOP_TOWER, timestamp_ms: 5 * MIN }, 'TOP')).toBe('lane')
  })
})

describe('classifyDeath', () => {
  const enemies = new Map([
    [6, { position: 'TOP', assists: new Set<number>() }],
    [7, { position: 'JUNGLE', assists: new Set<number>([5 * MIN]) }],
    [8, { position: 'MIDDLE', assists: new Set<number>() }],
    [9, { position: 'BOTTOM', assists: new Set<number>([21 * MIN]) }],
    [10, { position: 'UTILITY', assists: new Set<number>([21 * MIN]) }],
  ])
  const ctx = { teamId: 100, teamPosition: 'TOP', enemies }
  const death = (death_by: number, position: { x: number; y: number }, min: number) => ({
    death_by,
    position,
    timestamp_ms: min * MIN,
  })

  it('death near own tower = dive', () => {
    expect(classifyDeath(death(6, { x: 10504, y: 1200 }, 5), { ...ctx, teamPosition: 'BOTTOM' })).toBe('dive')
    expect(classifyDeath(death(6, BLUE_BOT_TOWER, 5), { ...ctx, teamId: 200 })).not.toBe('dive')
  })
  it('enemy jungler kills or assists in lane before 20 min = gank', () => {
    expect(classifyDeath(death(7, TOP, 6), ctx)).toBe('gank')
    expect(classifyDeath(death(6, TOP, 5), ctx)).toBe('gank')
  })
  it('enemy laner out of his lane before 20 min = roam', () => {
    expect(classifyDeath(death(8, TOP, 9), ctx)).toBe('roam')
  })
  it('killer alone = solo (1v1), helpers = fight', () => {
    expect(classifyDeath(death(6, TOP, 9), ctx)).toBe('solo')
    expect(classifyDeath(death(9, MID, 21), { ...ctx, teamPosition: 'MIDDLE' })).toBe('fight')
  })
  it('no champion killer (tower, minions) = other', () => {
    expect(classifyDeath(death(0, TOP, 9), ctx)).toBe('other')
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
    expect(map.deaths).toEqual([[3800, 7800, 90, 'other']])
    expect(map.wardsPlaced).toEqual([
      [7400, 7400, 61, 'control'],
      [12000, 2000, 120, 'trinket'],
    ])
    expect(map.wardsKilled).toEqual([[3800, 7800, 240, 'ward']])
  })

  it('classifies deaths with the enemies of the match', () => {
    const map = buildChampionEventMap([
      {
        team_id: 100,
        team_position: 'TOP',
        death_history: [
          { death_by: 6, timestamp_ms: 9 * MIN, position: TOP },
          { death_by: 8, timestamp_ms: 9 * MIN, position: TOP },
        ],
        enemies: [
          { id: 6, position: 'TOP', assists: [] },
          { id: 8, position: 'MIDDLE', assists: null },
        ],
      },
    ])
    expect(map.deaths.map(d => d[3])).toEqual(['solo', 'roam'])
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
