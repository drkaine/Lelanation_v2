import { describe, expect, it } from 'vitest'
import {
  formatClearTime,
  jungleApiPatch,
  jungleStep,
  jungleSideViews,
  type JunglePathApiRow,
} from '../junglePaths'

const row = (p: Partial<JunglePathApiRow>): JunglePathApiRow => ({
  pathSequence: ['red_buff_blue', 'scuttler_blue'],
  pathHash: 'h',
  games: 10,
  wins: 5,
  winrate: 0.5,
  share: 0.2,
  avgClearTimeMs: 180000,
  ...p,
})

describe('jungleStep', () => {
  it('décode type, côté et position (y inversé)', () => {
    expect(jungleStep('blue_buff_blue')).toEqual({
      key: 'blue_buff_blue',
      type: 'blue_buff',
      side: 'blue',
      x: 25.3,
      y: 48,
    })
    expect(jungleStep('dragon')).toMatchObject({ type: 'dragon', side: null })
    expect(jungleStep('???')).toMatchObject({ type: 'unknown', x: 50, y: 50 })
  })
})

describe('formatClearTime / jungleApiPatch', () => {
  it('formate m:ss et ignore les valeurs vides', () => {
    expect(formatClearTime(229664)).toBe('3:50')
    expect(formatClearTime(null)).toBeNull()
    expect(formatClearTime(0)).toBeNull()
  })
  it('réduit la version à major.minor', () => {
    expect(jungleApiPatch('16.22.1')).toBe('16.22')
    expect(jungleApiPatch('16.22')).toBe('16.22')
    expect(jungleApiPatch('')).toBeNull()
  })
})

describe('jungleSideViews', () => {
  const res = {
    sides: [
      {
        teamId: 200,
        games: 40,
        starts: [{ camp: 'krugs', games: 30, share: 0.75 }],
        paths: [row({ pathHash: 'r', winrate: 0.4 })],
      },
      {
        teamId: 100,
        games: 50,
        starts: [
          { camp: 'blue_buff', games: 27, share: 0.54 },
          { camp: 'red_buff', games: 23, share: 0.46 },
        ],
        paths: [
          row({ pathHash: 'b', games: 20, winrate: 0.55, share: 0.4 }),
          row({ pathHash: 'z', games: 0 }),
        ],
      },
    ],
  }
  const views = jungleSideViews(res)

  it('met le côté bleu en premier', () => {
    expect(views.map(v => v.side)).toEqual(['blue', 'red'])
  })

  it('donne les départs en % arrondis', () => {
    expect(views[0]!.starts).toEqual([
      { type: 'blue_buff', pct: 54 },
      { type: 'red_buff', pct: 46 },
    ])
  })

  it('convertit les paths (winrate et part en %, polyline), sans path vide', () => {
    expect(views[0]!.paths).toHaveLength(1)
    expect(views[0]!.paths[0]).toMatchObject({
      hash: 'b',
      side: 'blue',
      winrate: 55,
      pct: 40,
      clearTime: '3:00',
    })
    expect(views[0]!.paths[0]!.polyline).toBe('52,74 27.3,72.7')
  })

  it('renvoie une liste vide sans données', () => {
    expect(jungleSideViews(null)).toEqual([])
  })
})
