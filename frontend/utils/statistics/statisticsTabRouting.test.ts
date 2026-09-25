import { describe, expect, it } from 'vitest'
import { isStatisticsMainTab, normalizeLegacyTab, queryFirst } from './statisticsTabRouting'

describe('statisticsTabRouting', () => {
  it('legacy_tabs_map_to_current_tabs', () => {
    expect(['tierlist', 'sides', 'abandons', 'champion-table'].map(normalizeLegacyTab)).toEqual([
      'overview',
      'team',
      'team',
      'championTable',
    ])
  })

  it('main_tab_guard_rejects_unknown_ids', () => {
    expect([isStatisticsMainTab('bans'), isStatisticsMainTab('nope')]).toEqual([true, false])
  })

  it('query_first_reads_first_value', () => {
    expect([queryFirst(['a', 'b']), queryFirst(undefined)]).toEqual(['a', ''])
  })
})
