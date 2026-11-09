import { describe, expect, it } from 'vitest'
import {
  balanceLevelGlyph,
  balanceVerdictRank,
  splitStatusDelta,
} from '~/utils/statistics/balanceVerdict'

describe('balanceVerdict', () => {
  it('glyphe par statut de niveau', () => {
    expect(balanceLevelGlyph('OVERPOWERED')).toEqual({ glyph: '▲', tone: 'op' })
    expect(balanceLevelGlyph('UNDERPOWERED')).toEqual({ glyph: '▼', tone: 'up' })
    expect(balanceLevelGlyph('BALANCED')).toEqual({ glyph: '=', tone: 'eq' })
  })

  it('ordre de la maquette : nerf, buff, équilibré', () => {
    expect(balanceVerdictRank('OVERPOWERED')).toBeLessThan(balanceVerdictRank('UNDERPOWERED'))
    expect(balanceVerdictRank('UNDERPOWERED')).toBeLessThan(balanceVerdictRank('BALANCED'))
  })

  it('découpe un delta "A -> B"', () => {
    expect(splitStatusDelta('BALANCED -> OVERPOWERED')).toEqual(['BALANCED', 'OVERPOWERED'])
    expect(splitStatusDelta(null)).toBeNull()
    expect(splitStatusDelta('')).toBeNull()
    expect(splitStatusDelta('BALANCED')).toBeNull()
  })
})
