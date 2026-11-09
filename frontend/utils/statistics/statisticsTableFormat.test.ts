import { describe, expect, it } from 'vitest'
import {
  championGlobalNumericDeltaClass,
  formatChampionGlobalNumericDelta,
  formatTierListPatchDeltaPp,
  hasMeaningfulProgressionDelta,
  normalizeStatsRoleKey,
  tierListWinrateClass,
} from './statisticsTableFormat'

describe('statisticsTableFormat', () => {
  it('winrate_class_highlights_strong_winrates', () => {
    expect([tierListWinrateClass(53), tierListWinrateClass(49)]).toEqual([
      'font-medium text-info',
      'text-error/90',
    ])
  })

  it('delta_formatters_add_explicit_plus_sign', () => {
    expect([formatTierListPatchDeltaPp(1.234), formatChampionGlobalNumericDelta(-0.26)]).toEqual([
      '+1.23',
      '▼ −0.3',
    ])
  })

  it('numeric_delta_uses_arrows_and_rounds_large_values', () => {
    expect([
      formatChampionGlobalNumericDelta(320.4),
      formatChampionGlobalNumericDelta(3.14),
      formatChampionGlobalNumericDelta(0.01),
    ]).toEqual(['▲ +320', '▲ +3.1', '0.0'])
  })

  it('numeric_delta_class_inverts_when_lower_is_better', () => {
    expect(championGlobalNumericDeltaClass(1, true)).toBe('text-error/90')
  })

  it('progression_delta_ignores_noise', () => {
    expect([hasMeaningfulProgressionDelta(0), hasMeaningfulProgressionDelta(2)]).toEqual([
      false,
      true,
    ])
  })

  it('role_key_normalizes_aliases', () => {
    expect(['utility', 'mid', 'adc'].map(normalizeStatsRoleKey)).toEqual([
      'SUPPORT',
      'MIDDLE',
      'BOTTOM',
    ])
  })
})
