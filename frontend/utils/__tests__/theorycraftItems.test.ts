import { describe, expect, it } from 'vitest'
import type { Item } from '@lelanation/shared-types'
import {
  activeItemLimitLabel,
  countActiveNonStarterItems,
  isWithinActiveItemLimit,
} from '../theorycraftItems'

function item(id: string, tags: string[] = []): Item {
  return {
    id,
    name: id,
    image: { full: `${id}.png` },
    tags,
  } as Item
}

describe('theorycraftItems', () => {
  it('counts boots toward the limit for non-adc roles', () => {
    const items = [
      item('boots', ['Boots']),
      item('core1'),
      item('core2'),
      item('core3'),
      item('core4'),
      item('core5'),
    ]
    const disabled = new Set<number>()
    expect(isWithinActiveItemLimit(items, disabled, ['mid'])).toBe(true)

    const sevenActive = [...items, item('core6')]
    expect(isWithinActiveItemLimit(sevenActive, disabled, ['mid'])).toBe(false)
  })

  it('allows boots in addition to six items for adc', () => {
    const items = [
      item('boots', ['Boots']),
      item('core1'),
      item('core2'),
      item('core3'),
      item('core4'),
      item('core5'),
      item('core6'),
    ]
    const disabled = new Set<number>()
    expect(isWithinActiveItemLimit(items, disabled, ['adc'])).toBe(true)
    expect(activeItemLimitLabel(items, disabled, ['adc'])).toBe('6/6 + boots')

    const tooManyCore = [...items, item('core7')]
    expect(isWithinActiveItemLimit(tooManyCore, disabled, ['adc'])).toBe(false)
  })

  it('ignores starter items in active counts', () => {
    const items = [item('starter', ['Starter']), item('core1'), item('core2')]
    const disabled = new Set<number>()
    expect(countActiveNonStarterItems(items, disabled).total).toBe(2)
  })
})
