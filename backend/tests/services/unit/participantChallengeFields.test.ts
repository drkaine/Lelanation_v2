import { describe, expect, it } from 'vitest'
import {
  collectUnmappedChallengeFields,
  DEPRECATED_CHALLENGE_KEYS,
} from '../../../src/constants/participantChallengeFields.js'

describe('participantChallengeFields', () => {
  it('skips deprecated challenge keys', () => {
    expect(DEPRECATED_CHALLENGE_KEYS.has('firstTurretKilledTime')).toBe(true)
    expect(DEPRECATED_CHALLENGE_KEYS.has('teleportTakedowns')).toBe(true)
  })

  it('stores unmapped challenge keys in extra payload', () => {
    const extra = collectUnmappedChallengeFields(
      {
        firstTurretKilledTime: 42,
        baronBuffGoldAdvantageOverThreshold: 3,
        futureChallengeMetric: 7,
      },
      {
        mappedKeys: new Set(['baronBuffGoldAdvantageOverThreshold']),
      },
    )
    expect(extra).toEqual({ futureChallengeMetric: 7 })
  })
})
