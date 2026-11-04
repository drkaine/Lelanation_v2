import { describe, expect, it } from 'vitest'
import { ITEM_TYPE_CHIPS, countItemTypes } from '../itemTypeCounts'

describe('countItemTypes', () => {
  it('counts rows per type and total', () => {
    const rows = [{ type: 'final' }, { type: 'final' }, { type: 'boots' }, { type: 'starter' }]
    expect(countItemTypes(rows)).toEqual({ all: 4, final: 2, core: 0, boots: 1, starter: 1 })
  })
  it('ignores unknown types in per-type counts', () => {
    expect(countItemTypes([{ type: 'x' }])).toEqual({
      all: 1,
      final: 0,
      core: 0,
      boots: 0,
      starter: 0,
    })
  })
  it('orders chips all, final, core, boots, starter', () => {
    expect(ITEM_TYPE_CHIPS).toEqual(['all', 'final', 'core', 'boots', 'starter'])
  })
})
