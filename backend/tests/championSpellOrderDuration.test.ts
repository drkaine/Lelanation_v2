import { describe, expect, it } from 'vitest'
import {
  CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS,
  estimatedLastSpellLevelUpMs,
  isLegacyPseudoSpellOrder,
  shouldIncludeSpellOrderAggregateRow,
  spellOrderLevelCount,
  spellOrderMeetsMinDuration,
} from '../src/services/championSpellOrderDuration.js'

describe('championSpellOrderDuration', () => {
  it('counts skill levels in spell order key', () => {
    expect(spellOrderLevelCount('')).toBe(0)
    expect(spellOrderLevelCount('1-2-1-3')).toBe(4)
    expect(spellOrderLevelCount('1-2-1-3-1-4-1-2-1-2-4-2-3-3-4-3-3')).toBe(18)
  })

  it('estimates last level-up from average sum timestamp', () => {
    const n = 18
    const lastMs = 16 * 60 * 1000
    const avgSum = (lastMs * n) / 2
    expect(estimatedLastSpellLevelUpMs(avgSum, n)).toBeCloseTo(lastMs, -2)
  })

  it('rejects short-game proxy and accepts 15+ min proxy', () => {
    const order = '1-2-1-3-1-4-1-2-1-2-4-2-3-3-4-3-3'
    const n = spellOrderLevelCount(order)
    const min = CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS
    const shortAvgSum = (10 * 60 * 1000 * n) / 2
    const longAvgSum = (16 * 60 * 1000 * n) / 2
    expect(spellOrderMeetsMinDuration(shortAvgSum, 100, order, min)).toBe(false)
    expect(spellOrderMeetsMinDuration(longAvgSum, 100, order, min)).toBe(true)
  })

  it('detects legacy pseudo orders without timestamps', () => {
    expect(isLegacyPseudoSpellOrder('1-4-2-3', 0)).toBe(true)
    expect(isLegacyPseudoSpellOrder('1-2-3-1-1-4-1-2', 0)).toBe(false)
    expect(isLegacyPseudoSpellOrder('1-4-2-3', 900000)).toBe(false)
  })

  it('includes rows without timestamps when not legacy pseudo orders', () => {
    const order = '1-2-3-1-1-4-1-2-1-2-4-2-2-3'
    expect(
      shouldIncludeSpellOrderAggregateRow(0, 50, order, CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS)
    ).toBe(true)
  })

  it('excludes legacy pseudo orders even when duration filter is off', () => {
    expect(shouldIncludeSpellOrderAggregateRow(0, 100, '1-4-2-3', 0)).toBe(false)
  })

  it('applies duration filter only when timestamps are present', () => {
    const order = '1-2-1-3-1-4-1-2-1-2-4-2-3-3-4-3-3'
    const n = 18
    const shortAvgSum = (10 * 60 * 1000 * n) / 2
    expect(
      shouldIncludeSpellOrderAggregateRow(
        shortAvgSum,
        100,
        order,
        CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS
      )
    ).toBe(false)

    const longAvgSum = (16 * 60 * 1000 * n) / 2
    expect(
      shouldIncludeSpellOrderAggregateRow(
        longAvgSum,
        100,
        order,
        CHAMPION_SPELL_ORDER_MIN_GAME_DURATION_MS
      )
    ).toBe(true)
  })
})
