import { describe, expect, it } from 'vitest'
import { pingBarRows } from '../pingBarRows'

describe('pingBarRows', () => {
  it('trie par valeur décroissante, barre relative au max', () => {
    const rows = pingBarRows({ a: 2, b: 8, c: 4 }, ['a', 'b', 'c'])
    expect(rows.map(r => r.key)).toEqual(['b', 'c', 'a'])
    expect(rows.map(r => r.pct)).toEqual([100, 50, 25])
  })
  it('valeurs absentes ou nulles → 0, pas de division par zéro', () => {
    const rows = pingBarRows({ a: Number.NaN }, ['a', 'b'])
    expect(rows.map(r => [r.value, r.pct])).toEqual([
      [0, 0],
      [0, 0],
    ])
  })
})
