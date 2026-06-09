import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import {
  atlasUpgradeMissing,
  ensureJunglePetInItems,
  ensureSupportAtlasInItems,
  isSmiteSpell,
  normalizeBuildItemsAfterChange,
  stripSmiteFromSummonerSpells,
} from '../buildItemRules'
import { selectTheorycraftItemsForStats } from '../theorycraftItems'

const item = (id: string, tags: string[] = []): Item => ({ id, name: id, tags }) as Item

describe('buildItemRules', () => {
  it('adds Atlas when a support line starter is selected', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = ensureSupportAtlasInItems(
      [item('1055', ['starter']), item('3867', ['starter'])],
      ['support'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '3867'])
  })

  it('adds Atlas when support role is set without support line starter', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('1055', ['starter']), item('2003', ['starter'])],
      ['support'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '2003'])
  })

  it('replaces the only starter with Atlas without growing the build', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('1055', ['starter']), item('1001', ['boots']), item('3089')],
      ['support'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '1001', '3089'])
  })

  it('keeps a second starter after Atlas when support role is active', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('3865', ['starter']), item('2003', ['Consumable']), item('3089')],
      ['support'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '2003', '3089'])
  })

  it('keeps support line as second starter after Atlas is auto-added', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('3865', ['starter']), item('3867', ['starter']), item('3089')],
      ['support'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '3867', '3089'])
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
    expect(result.map(i => i.id)).toEqual(['1103'])
  })

  it('replaces the only starter with jungle pet without growing the build', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = ensureJunglePetInItems(
      [item('1055', ['starter']), item('1001', ['boots']), item('3089')],
      ['jungle'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['1103', '1001', '3089'])
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

  it('keeps the selected jungle pet instead of forcing the default green one', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = ensureJunglePetInItems(
      [item('1101', ['starter']), item('2003', ['starter']), item('3089')],
      ['jungle'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['1101', '2003', '3089'])
  })

  it('preserves blue jungle pet when jungle role normalization runs again', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('1102', ['starter']), item('2003', ['starter']), item('3089')],
      ['jungle'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['1102', '2003', '3089'])
  })

  it('uses real Data Dragon tags when replacing starters for jungle role', () => {
    const lookup = (id: string) =>
      ({
        '1103': item('1103', ['Jungle']),
        '1055': item('1055', ['Health', 'Damage', 'LifeSteal', 'SpellVamp', 'Lane']),
        '2003': item('2003', ['HealthRegen', 'Consumable', 'Lane', 'Jungle']),
      })[id]
    const cores = ['3006', '3089', '3135', '3026', '3031', '3036'].map(id => item(id, []))
    const result = normalizeBuildItemsAfterChange(
      [
        item('1055', ['Health', 'Damage', 'LifeSteal', 'SpellVamp', 'Lane']),
        item('2003', ['HealthRegen', 'Consumable', 'Lane', 'Jungle']),
        ...cores,
      ],
      ['jungle'],
      id => lookup(id)
    )
    expect(result.map(i => i.id)).toEqual(['1103', '2003', ...cores.map(i => i.id)])
    expect(result).toHaveLength(8)
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
      ['support'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '3867', '3089'])
  })

  it('removes jungle pet and atlas when roles are cleared', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('1103', ['starter']), item('3865', ['starter']), item('3089')],
      ['top'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3089'])
  })

  it('removes jungle pet when jungle role is removed but support stays', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('1103', ['Jungle']), item('3865', []), item('3089')],
      ['support'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3865', '3089'])
  })

  it('removes atlas when support role is removed but jungle stays', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const result = normalizeBuildItemsAfterChange(
      [item('1103', ['Jungle']), item('3865', []), item('3089')],
      ['jungle'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['1103', '3089'])
  })

  it('removes role-linked items stored with numeric ids when role is removed', () => {
    const lookup = (id: string) => item(id, ['starter'])
    const numericItem = (id: number, tags: string[] = []) =>
      ({ id, name: String(id), tags }) as Item
    const result = normalizeBuildItemsAfterChange(
      [numericItem(1103, ['Jungle']), numericItem(3865, []), item('3089')],
      ['top'],
      lookup
    )
    expect(result.map(i => i.id)).toEqual(['3089'])
  })

  it('strips smite from summoner spells when jungle role is removed', () => {
    const smite = {
      id: 'SummonerSmite',
      key: '11',
      name: 'Smite',
    } as import('@lelanation/shared-types').SummonerSpell
    expect(isSmiteSpell(smite)).toBe(true)
    expect(stripSmiteFromSummonerSpells([smite, null])).toEqual([null, null])
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
