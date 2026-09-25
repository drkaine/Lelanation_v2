import { describe, expect, it } from 'vitest'
import {
  aggregateObjectiveHistogramDist,
  distributionPercentRows,
  formatObjectiveObtentionPercent,
  matchOutcomePct,
  objectiveHasKillDropdown,
} from './statisticsObjectives'

describe('statisticsObjectives', () => {
  it('aggregate_folds_horde_counts_above_three', () => {
    expect(aggregateObjectiveHistogramDist('horde', { '2': 5, '4': 2, '6': 1 })).toEqual({
      2: 5,
      3: 3,
    })
  })

  it('aggregate_keeps_counts_for_other_objectives', () => {
    expect(aggregateObjectiveHistogramDist('baron', { '0': 3, '2': 1 })).toEqual({ 0: 3, 2: 1 })
  })

  it('distribution_rows_are_percent_of_matches', () => {
    expect(distributionPercentRows({ '1': 25, '2': 75 }, 100, 'baron')).toEqual([
      { count: 1, percent: 25 },
      { count: 2, percent: 75 },
    ])
  })

  it('distribution_rows_empty_when_no_match', () => {
    expect(distributionPercentRows({ '1': 1 }, 0)).toEqual([])
  })

  it('percent_helpers_format_two_decimals', () => {
    expect([matchOutcomePct(1, 4), formatObjectiveObtentionPercent(1, 3)]).toEqual([
      '25.00',
      '33.33%',
    ])
  })

  it('rift_herald_has_no_kill_dropdown', () => {
    expect([objectiveHasKillDropdown('baron'), objectiveHasKillDropdown('riftHerald')]).toEqual([
      true,
      false,
    ])
  })
})
