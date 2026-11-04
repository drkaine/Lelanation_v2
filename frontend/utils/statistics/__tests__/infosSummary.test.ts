import { describe, expect, it } from 'vitest'
import { infosSummary, type InfosRow } from '../infosSummary'

const rows: InfosRow[] = [
  { version: '16.2', all: 100, byDivision: { GOLD: 10, PLATINUM: 60, EMERALD: 30 } },
  { version: '16.10', all: 200, byDivision: { IRON: 2, GOLD: 80, PLATINUM: 100, EMERALD: 18 } },
]
const divs = ['IRON', 'GOLD', 'PLATINUM', 'EMERALD']

describe('infosSummary', () => {
  it('sums total and orders patches ascending with height relative to max', () => {
    const s = infosSummary(rows, divs)
    expect(s.total).toBe(300)
    expect(s.patches).toEqual([
      { version: '16.2', games: 100, heightPct: 50 },
      { version: '16.10', games: 200, heightPct: 100 },
    ])
  })
  it('splits latest patch by division with widths and shares', () => {
    const s = infosSummary(rows, divs)
    expect(s.latestVersion).toBe('16.10')
    expect(s.divisions[2]).toEqual({
      division: 'PLATINUM',
      games: 100,
      widthPct: 100,
      sharePct: 50,
    })
  })
  it('finds smallest contiguous division window covering >= 80 %', () => {
    expect(infosSummary(rows, divs).core).toEqual({ from: 'GOLD', to: 'PLATINUM', sharePct: 90 })
  })
  it('handles empty input', () => {
    expect(infosSummary([], divs)).toEqual({
      total: 0,
      patches: [],
      latestVersion: null,
      divisions: [],
      core: null,
    })
  })
})
