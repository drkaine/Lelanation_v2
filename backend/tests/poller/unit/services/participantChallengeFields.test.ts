import { describe, expect, it } from 'vitest'
import {
  collectUnmappedChallengeFields,
  DEPRECATED_CHALLENGE_KEYS,
} from '../../../../src/constants/participantChallengeFields.js'
import { CHAMPION_STATS_METRIC_COLUMN_SET } from '../../../../src/constants/championStatsMetricColumns.js'
import { CHALLENGE_COLUMN_MAP } from '../../../../src/services/normalizedMatchPersistence.js'

const REMOVED_KEYS = [
  'firstTurretKilledTime',
  'teleportTakedowns',
  'baronBuffGoldAdvantageOverThreshold',
  'controlWardTimeCoverageInRiverOrEnemyHalf',
  'earliestBaron',
  'earliestDragonTakedown',
  'shortestTimeToAceFromFirstTakedown',
]

describe('participantChallengeFields', () => {
  it('skips every challenge key removed by Riot', () => {
    for (const key of REMOVED_KEYS) expect(DEPRECATED_CHALLENGE_KEYS.has(key)).toBe(true)
  })

  it('no longer maps removed keys to participants columns', () => {
    for (const key of REMOVED_KEYS) expect(CHALLENGE_COLUMN_MAP[key]).toBeUndefined()
  })

  it('no longer aggregates removed keys in champion_stats', () => {
    for (const col of [
      'sum_earliest_baron',
      'sum_baron_buff_gold_advantage_over_threshold',
      'sum_shortest_time_to_ace_from_first_takedown',
    ]) expect(CHAMPION_STATS_METRIC_COLUMN_SET.has(col)).toBe(false)
  })

  it('stores unmapped challenge keys in extra payload', () => {
    const extra = collectUnmappedChallengeFields(
      {
        firstTurretKilledTime: 42,
        earliestDragonTakedown: 300,
        controlWardTimeCoverageInRiverOrEnemyHalf: 0.4,
        futureChallengeMetric: 7,
      },
      { mappedKeys: new Set() },
    )
    expect(extra).toEqual({ futureChallengeMetric: 7 })
  })
})
