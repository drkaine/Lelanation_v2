import { describe, expect, it } from 'vitest'
import { reconstructFirstClear } from '../../../../src/parsers/jungleFullClear.js'
import {
  extractJunglePathFromCamps,
  recalculateEarlyPath,
} from '../../../../src/parsers/junglePathExtract.js'

const c = (camp_key: string, timestamp_ms: number) => ({
  camp_type: camp_key.replace(/_(blue|red)$/, '').replace('_buff', ''),
  camp_key,
  timestamp_ms,
})

describe('reconstructFirstClear', () => {
  it('complète un full clear de 6 camps à partir des 2 points observés (1/min)', () => {
    const out = reconstructFirstClear([
      c('red_buff_blue', 120_000),
      c('wolves_blue', 180_000),
      c('scuttler_blue', 240_000),
    ])!
    const keys = out.map(e => e.camp_key)
    expect(keys.slice(0, 6).sort()).toEqual(
      [
        'blue_buff_blue',
        'gromp_blue',
        'krugs_blue',
        'raptors_blue',
        'red_buff_blue',
        'wolves_blue',
      ].sort()
    )
    // Ordre observé conservé, chaque quadrant vidé d'un bloc, crabe en fin.
    expect(keys.indexOf('red_buff_blue')).toBeLessThan(keys.indexOf('wolves_blue'))
    expect(keys.slice(0, 3).sort()).toEqual(['krugs_blue', 'raptors_blue', 'red_buff_blue'])
    expect(keys[6]).toBe('scuttler_blue')
    expect(out.map(e => e.timestamp_ms)).toEqual([...out.map(e => e.timestamp_ms)].sort((a, b) => a - b))
  })

  it('3 camps puis sortie : chemin court (pas de full clear)', () => {
    const out = reconstructFirstClear([c('blue_buff_red', 120_000), c('scuttler_red', 180_000)])!
    expect(out).toHaveLength(4)
    expect(out.slice(0, 3).map(e => e.camp_key)).toContain('blue_buff_red')
    expect(out.slice(0, 3).every(e => e.camp_key!.endsWith('_red'))).toBe(true)
    expect(out[3]!.camp_key).toBe('scuttler_red')
  })

  it('sans camp de son côté → null', () => {
    expect(reconstructFirstClear([c('scuttler_blue', 200_000)])).toBeNull()
    expect(reconstructFirstClear([])).toBeNull()
  })
})

describe('recalculateEarlyPath (backfill)', () => {
  it('recalcule early_path depuis un document stocké (camp_key conservé)', () => {
    const doc = {
      camps: [c('red_buff_blue', 120_000), c('wolves_blue', 180_000)],
      early_path: { path_sequence: ['red_buff_blue', 'wolves_blue'], path_hash: 'old', clear_time_ms: 1 },
    }
    const next = recalculateEarlyPath(doc)!
    expect(next.early_path!.path_sequence).toHaveLength(6)
    expect(next.early_path!.path_hash).not.toBe('old')
    expect(next.camps[0]!.camp_key).toBe('red_buff_blue')
    expect(recalculateEarlyPath('nope')).toBeNull()
  })
})

describe('extractJunglePathFromCamps', () => {
  it('utilise la reconstruction (6 camps + crabe)', () => {
    const r = extractJunglePathFromCamps([c('red_buff_blue', 120_000), c('wolves_blue', 180_000)])!
    expect(r.pathSequence).toHaveLength(6)
    expect(r.pathSequence[0]).toMatch(/_blue$/)
  })
})
