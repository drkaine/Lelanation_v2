import { describe, expect, it } from 'vitest'
import { itemCohortRoleFilter, itemRoleSum } from '../../../../src/stats/itemSnapshotRoleSql.js'

describe('itemCohortRoleFilter', () => {
  it('maps the role bucket to the champion snapshot role', () => {
    expect(itemCohortRoleFilter('MID', 'cohort')).toBe("cohort.role = 'MIDDLE'")
    expect(itemCohortRoleFilter('adc', 'c')).toBe("c.role = 'BOTTOM'")
    expect(itemCohortRoleFilter('SUPPORT', 'c')).toBe("c.role = 'UTILITY'")
    expect(itemCohortRoleFilter('TOP', 'c')).toBe("c.role = 'TOP'")
    expect(itemCohortRoleFilter('JUNGLE', 'c')).toBe("c.role = 'JUNGLE'")
  })

  it('is TRUE without a known role', () => {
    expect(itemCohortRoleFilter(null, 'c')).toBe('TRUE')
    expect(itemCohortRoleFilter('FILL', 'c')).toBe('TRUE')
  })
})

describe('itemRoleSum', () => {
  it('sums the role bucket column, or the total without role', () => {
    expect(itemRoleSum('MIDDLE', 'item', 'games')).toBe('COALESCE(SUM(item.mid_game), 0)')
    expect(itemRoleSum('UTILITY', 'item', 'wins')).toBe('COALESCE(SUM(item.support_win), 0)')
    expect(itemRoleSum(null, 'item', 'games')).toBe('COALESCE(SUM(item.games), 0)')
    expect(itemRoleSum(undefined, 'item', 'wins')).toBe('COALESCE(SUM(item.wins), 0)')
  })
})
