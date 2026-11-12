import { describe, expect, it } from 'vitest'
import { surrenderBarWidths, surrenderDeltaView } from '../surrenderDivisionRows'

describe('surrenderBarWidths', () => {
  it('scale sur 50 % : early puis reste', () => {
    expect(surrenderBarWidths(20, 5)).toEqual({ early: 10, rest: 30 })
  })
  it('borne à 100 au total', () => {
    const w = surrenderBarWidths(80, 10)
    expect(w.early + w.rest).toBe(100)
    expect(w.early).toBe(20)
  })
  it('valeurs invalides → 0', () => {
    expect(surrenderBarWidths(null, undefined)).toEqual({ early: 0, rest: 0 })
  })
})

describe('surrenderDeltaView', () => {
  it('hausse = up', () => {
    expect(surrenderDeltaView(2.96)).toEqual({ dir: 'up', abs: 2.96 })
  })
  it('baisse = down', () => {
    expect(surrenderDeltaView(-7)).toEqual({ dir: 'down', abs: 7 })
  })
  it('null → none', () => {
    expect(surrenderDeltaView(null)).toEqual({ dir: 'none', abs: null })
  })
})
