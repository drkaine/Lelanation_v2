import { describe, it, expect } from 'vitest'
import { tierListMinGames, rolePickrate } from '../../../src/services/tierListSample.js'

describe('tierListMinGames', () => {
  it('plancher de 10 parties sur petit échantillon (Iron, Master)', () => {
    expect(tierListMinGames(58)).toBe(10)
    expect(tierListMinGames(0)).toBe(10)
  })
  it('0,5 % des matchs sur gros échantillon', () => {
    expect(tierListMinGames(15663)).toBe(79)
  })
})

describe('rolePickrate', () => {
  it('rapporte aux matchs (2 joueurs par rôle et par match)', () => {
    // 2636 Jhin bot sur 33000 picks bot = 16 500 matchs → 16 %
    expect(rolePickrate(2636, 33000)).toBeCloseTo(2636 / 16500, 6)
  })
  it('0 si pas de total', () => {
    expect(rolePickrate(5, 0)).toBe(0)
  })
})
