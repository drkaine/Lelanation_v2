import { describe, expect, it } from 'vitest'
import { theorycraftTooltipTestUtils } from '../../../../src/services/TheorycraftDataBuilderService.js'

const { crossCheckedStat, partitionStatMismatches } = theorycraftTooltipTestUtils

describe('theorycraft stat cross-check', () => {
  it('separates expected ddragon=0 corrections from real divergences', () => {
    const mismatches: string[] = []
    expect(crossCheckedStat(0, 3.5, 'attackDamage/lvl', mismatches)).toBe(3.5)
    expect(crossCheckedStat(600, 650, 'hp', mismatches)).toBe(600)

    const { corrections, divergences } = partitionStatMismatches(mismatches)
    expect(corrections).toEqual(['attackDamage/lvl'])
    expect(divergences).toEqual(['hp: ddragon=600 ≠ bin=650 (ddragon conservé)'])
  })

  it('returns empty lists when nothing differs', () => {
    expect(partitionStatMismatches([])).toEqual({ corrections: [], divergences: [] })
  })
})
