import { describe, expect, it } from 'vitest'
import { comparePatchMajorMinor } from './patchVersion'

describe('comparePatchMajorMinor', () => {
  it('compare_orders_by_minor_when_major_is_equal', () => {
    expect(Math.sign(comparePatchMajorMinor('16.12', '16.13'))).toBe(-1)
  })

  it('compare_orders_by_major_first', () => {
    expect(Math.sign(comparePatchMajorMinor('17.1', '16.24'))).toBe(1)
  })

  it('compare_returns_zero_when_minor_is_missing', () => {
    expect(comparePatchMajorMinor('16', '16.3')).toBe(0)
  })

  it('compare_returns_zero_when_second_major_is_not_a_number', () => {
    expect(comparePatchMajorMinor('16.3', 'x.3')).toBe(0)
  })
})
