import { describe, expect, it } from 'vitest'
import {
  buildTriggerMatchesFilter,
  championMatchesAlertFilters,
  filterBuildTriggers,
  filterStatsTriggers,
  statsTriggerMatchesFilter,
} from './surveillanceAlertFilters'
import type { BuildSurveillanceTrigger } from './buildSurveillance'
import type { SurveillanceAlertTrigger } from './statisticsSurveillanceAlerts'

const statsDeltaUp: SurveillanceAlertTrigger = {
  kind: 'delta',
  metric: 'winrate',
  threshold: 5,
  current: 55,
  reference: 48,
  cohortKey: 'GLOBAL',
}

const buildNew: BuildSurveillanceTrigger = {
  kind: 'new',
  fingerprint: 'a-b',
  items: [1, 2, 3],
  threshold: 0,
  current: 52,
}

describe('surveillanceAlertFilters', () => {
  it('matches stats and build triggers', () => {
    expect(statsTriggerMatchesFilter(statsDeltaUp, 'championWinrateUp')).toBe(true)
    expect(statsTriggerMatchesFilter(statsDeltaUp, 'championWinrateDown')).toBe(false)
    expect(buildTriggerMatchesFilter(buildNew, 'buildNew')).toBe(true)
    expect(buildTriggerMatchesFilter(buildNew, 'buildWinrateUp')).toBe(false)
  })

  it('filters trigger lists', () => {
    expect(filterStatsTriggers([statsDeltaUp], ['championWinrateDown'])).toHaveLength(0)
    expect(filterBuildTriggers([buildNew], ['buildNew'])).toHaveLength(1)
  })

  it('matches champions with grouped OR / AND logic', () => {
    expect(
      championMatchesAlertFilters([statsDeltaUp], [buildNew], ['championWinrateUp', 'buildNew'])
    ).toBe(true)
    expect(championMatchesAlertFilters([statsDeltaUp], [], ['buildNew'])).toBe(false)
    expect(championMatchesAlertFilters([], [buildNew], ['championWinrateUp', 'buildNew'])).toBe(
      false
    )
    expect(championMatchesAlertFilters([statsDeltaUp], [], ['championWinrateUp'])).toBe(true)
  })
})
