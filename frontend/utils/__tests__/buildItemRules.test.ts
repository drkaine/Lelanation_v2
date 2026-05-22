import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import {
  atlasUpgradeMissing,
  ensureJunglePetInItems,
  ensureSupportAtlasInItems,
  normalizeBuildItemsAfterChange,
} from '../buildItemRules'
import { selectTheorycraftItemsForStats } from '../theorycraftItems'

const item = (id: string, tags: string[] = []): Item => ({ id, name: id, tags }) as Item

describe('buildItemRules', () => {
  it('adds Atlas when a support line starter is selected', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = ensureSupportAtlasInItems(
      [item('1055', ['starter']), item('3867', ['starter'])],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '3867'])
  })

  it('replaces first starter with Atlas when two starters and support line added', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('3867', ['starter']), item('1055', ['starter'])],
      ['support'],
      lookup
    )
    expect(result[0]?.id).toBe('3865')
    expect(result[1]?.id).toBe('3867')
  })

  it('requires atlas upgrade for support builds with support starters', () => {
    expect(
      atlasUpgradeMissing(
        [item('3865', ['starter']), item('3867', ['starter']), item('3089')],
        ['support']
      )
    ).toBe(true)
    expect(
      atlasUpgradeMissing(
        [item('3865', ['starter']), item('3867', ['starter']), item('3869')],
        ['support']
      )
    ).toBe(false)
  })

  it('adds green jungle pet when jungle role is set', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = ensureJunglePetInItems([item('1055', ['starter'])], ['jungle'], lookup)
    expect(result[0]?.id).toBe('1103')
  })

  it('replaces first starter with jungle pet and does not move displaced starter to core', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = ensureJunglePetInItems(
      [item('1055', ['starter']), item('2003', ['starter']), item('3089')],
      ['jungle'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['1103', '2003', '3089'])
  })

  it('drops overflow starters from core when support atlas is applied', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = ensureSupportAtlasInItems(
      [
        item('1055', ['starter']),
        item('3867', ['starter']),
        item('2003', ['starter']),
        item('3089'),
      ],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '3867', '3089'])
  })
})

describe('selectTheorycraftItemsForStats', () => {
  it('counts boots inside the 6 active slots for non-ADC', () => {
    const items = [
      item('1055', ['starter']),
      item('1001', ['boots']),
      item('1'),
      item('2'),
      item('3'),
      item('4'),
      item('5'),
      item('6'),
    ]
    const disabled = new Set([6, 7])
    const selected = selectTheorycraftItemsForStats(items, disabled, ['top'])
    const ids = selected.map(i => i.id)
    expect(ids).toContain('1055')
    expect(ids).toContain('1001')
    expect(ids).toContain('1')
    expect(ids).not.toContain('6')
    expect(selected.filter(i => !i.tags?.includes('starter')).length).toBeLessThanOrEqual(6)
  })

  it('allows 6 core plus one boot for ADC', () => {
    const items = [
      item('1001', ['boots']),
      item('3006', ['boots']),
      ...Array.from({ length: 6 }, (_, i) => item(`core-${i}`)),
    ]
    const selected = selectTheorycraftItemsForStats(items, new Set(), ['adc'])
    const nonStarters = selected.filter(i => !i.tags?.includes('starter'))
    expect(nonStarters.filter(i => i.tags?.includes('boots')).length).toBe(1)
    expect(nonStarters.filter(i => !i.tags?.includes('boots')).length).toBe(6)
  })
})
