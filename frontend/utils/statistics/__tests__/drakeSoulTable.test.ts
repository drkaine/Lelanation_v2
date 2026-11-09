import { describe, expect, it } from 'vitest'
import { drakeSoulTable } from '../drakeSoulTable'

const row = (key: string, value: number) => ({ key, label: key.toUpperCase(), value })

describe('drakeSoulTable', () => {
  it('merges_by_key_sorted_by_drake_share_elder_last', () => {
    const out = drakeSoulTable(
      [row('elder', 3), row('fire', 48), row('earth', 49)],
      [row('fire', 2), row('earth', 2)]
    )
    expect(out.map(r => r.key)).toEqual(['earth', 'fire', 'elder'])
    expect(out[0]).toEqual({ key: 'earth', label: 'EARTH', drakePct: 49, soulPct: 50 })
    expect(out[2]!.soulPct).toBeNull()
  })
  it('empty_inputs_give_empty_table', () => {
    expect(drakeSoulTable([], [])).toEqual([])
  })
  it('soul_only_key_is_kept', () => {
    const out = drakeSoulTable([row('fire', 1)], [row('water', 1)])
    expect(out.find(r => r.key === 'water')).toEqual({
      key: 'water',
      label: 'WATER',
      drakePct: null,
      soulPct: 100,
    })
  })
})
