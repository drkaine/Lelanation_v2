import { describe, expect, it } from 'vitest'
import { swapItems } from './swapItems'

describe('swapItems', () => {
  it('swap_items_exchanges_two_positions', () => {
    expect(swapItems(['a', 'b', 'c'], 0, 2)).toEqual(['c', 'b', 'a'])
  })

  it('swap_items_returns_unchanged_copy_when_index_out_of_range', () => {
    expect(swapItems(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
  })

  it('swap_items_does_not_mutate_input', () => {
    const input = ['a', 'b']
    swapItems(input, 0, 1)
    expect(input).toEqual(['a', 'b'])
  })
})
