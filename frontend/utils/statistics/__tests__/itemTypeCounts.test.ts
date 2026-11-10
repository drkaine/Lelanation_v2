import { describe, expect, it } from 'vitest'
import {
  ITEM_TYPE_CHIPS,
  classifyItemType,
  countItemTypes,
  type ClassifiableItem,
} from '../itemTypeCounts'

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

describe('classifyItemType', () => {
  const it0 = (o: Partial<ClassifiableItem>): ClassifiableItem => ({
    id: '1',
    tags: [],
    gold: { total: 0 },
    ...o,
  })
  it('boots by tag, including base boots', () => {
    expect(classifyItemType(it0({ id: '1001', tags: ['Boots'], into: ['3020'] }))).toBe('boots')
    expect(classifyItemType(it0({ id: '3020', tags: ['Boots'], from: ['1001'] }))).toBe('boots')
  })
  it('starter: consumable, lane or jungle start without recipe', () => {
    expect(classifyItemType(it0({ id: '2003', tags: ['Consumable'], gold: { total: 50 } }))).toBe(
      'starter'
    )
    expect(classifyItemType(it0({ id: '1055', tags: ['Lane'], gold: { total: 450 } }))).toBe(
      'starter'
    )
    expect(classifyItemType(it0({ id: '1101', tags: ['Jungle'], gold: { total: 450 } }))).toBe(
      'starter'
    )
  })
  it('final: built item with no upgrade', () => {
    expect(
      classifyItemType(it0({ id: '3031', from: ['1038', '1018'], gold: { total: 3400 } }))
    ).toBe('final')
    expect(classifyItemType(it0({ id: '2526', from: [] }))).toBe('final')
  })
  it('lane component with upgrade is core, support starter stays starter', () => {
    expect(classifyItemType(it0({ id: '1036', tags: ['Lane'], into: ['3133'] }))).toBe('core')
    expect(classifyItemType(it0({ id: '3865', tags: ['Lane'], into: ['3866'] }))).toBe('starter')
  })
  it('core: components and unknown items', () => {
    expect(classifyItemType(it0({ id: '1036', into: ['3133'], gold: { total: 350 } }))).toBe('core')
    expect(classifyItemType(undefined)).toBe('core')
  })
})
