import { describe, expect, it } from 'vitest'
import { isOneOf } from './isOneOf'

describe('isOneOf', () => {
  it('accepts_a_listed_value', () => {
    expect(isOneOf(['a', 'b'] as const, 'b')).toBe(true)
  })

  it('rejects_an_unlisted_value', () => {
    expect(isOneOf(['a', 'b'] as const, 'c')).toBe(false)
  })
})
