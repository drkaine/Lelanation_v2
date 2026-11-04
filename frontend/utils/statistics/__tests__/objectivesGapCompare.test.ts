import { describe, expect, it } from 'vitest'
import { objectivesGapRows } from '../objectivesGapCompare'

describe('objectivesGapRows', () => {
  it('sorts by absolute gap desc and computes gap a - b', () => {
    const out = objectivesGapRows([
      { key: 'dragon', a: 60, b: 50 },
      { key: 'baron', a: 30, b: 70 },
      { key: 'tower', a: 55, b: 52 },
    ])
    expect(out.map(r => r.key)).toEqual(['baron', 'dragon', 'tower'])
    expect(out[0]!.gap).toBe(-40)
  })
  it('drops rows with a missing side and clamps to 0..100', () => {
    const out = objectivesGapRows([
      { key: 'x', a: null, b: 10 },
      { key: 'y', a: 120, b: -5 },
    ])
    expect(out).toEqual([{ key: 'y', a: 100, b: 0, gap: 100 }])
  })
  it('rounds to 2 decimals', () => {
    expect(objectivesGapRows([{ key: 'z', a: 33.3333, b: 11.1111 }])[0]).toEqual({
      key: 'z',
      a: 33.33,
      b: 11.11,
      gap: 22.22,
    })
  })
})
