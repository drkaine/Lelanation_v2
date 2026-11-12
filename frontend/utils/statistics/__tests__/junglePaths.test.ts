import { describe, expect, it } from 'vitest'
import {
  formatClearTime,
  jungleApiPatch,
  jungleStep,
  junglePathViews,
  type JunglePathApiRow,
} from '../junglePaths'

const row = (p: Partial<JunglePathApiRow>): JunglePathApiRow => ({
  teamId: 100,
  pathSequence: ['red_buff_blue', 'scuttler_blue'],
  pathHash: 'h',
  games: 10,
  wins: 5,
  winrate: 0.5,
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

describe('junglePathViews', () => {
  it('trie par parties, filtre le côté, limite, winrate en %', () => {
    const rows = [
      row({ pathHash: 'a', games: 5, teamId: 200, winrate: 0.4 }),
      row({ pathHash: 'b', games: 20, winrate: 0.55 }),
      row({ pathHash: 'c', games: 12 }),
      row({ pathHash: 'd', games: 0 }),
    ]
    const all = junglePathViews(rows, { limit: 2 })
    expect(all.map(p => p.hash)).toEqual(['b', 'c'])
    expect(all[0]).toMatchObject({ side: 'blue', winrate: 55, clearTime: '3:00' })
    expect(all[0]!.polyline).toBe('52,74 27.3,72.7')
    expect(junglePathViews(rows, { limit: 5, side: 'red' }).map(p => p.hash)).toEqual(['a'])
  })
})
