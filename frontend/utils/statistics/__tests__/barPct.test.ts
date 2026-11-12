import { describe, expect, it } from 'vitest'
import { barPct } from '../barPct'

describe('barPct', () => {
  it('rapporte la valeur au maximum, en %', () => {
    expect(barPct(25, 50)).toBe(50)
    expect(barPct(50, 50)).toBe(100)
  })

  it('borne entre 0 et 100, sans max exploitable', () => {
    expect(barPct(80, 50)).toBe(100)
    expect(barPct(-3, 50)).toBe(0)
    expect(barPct(10, 0)).toBe(0)
    expect(barPct(Number.NaN, 10)).toBe(0)
  })
})
