import { describe, expect, it } from 'vitest'
import { participantItemSetKeys } from '../../../../src/services/normalizedParticipantMapper.js'

describe('participantItemSetKeys', () => {
  it('calcule starter/core/final depuis item_history', () => {
    const keys = participantItemSetKeys({
      '1055': 5_000, '2003': 6_000, '1001': 300_000, '6672': 600_000,
      '3006': 700_000, '3031': 900_000, '3046': 1_200_000, '3036': 1_500_000,
    })
    expect(keys).toEqual({
      starterKey: '1055',
      coreKey: '3031_3046_6672',
      bootsKey: '3006',
      finalKey: '1055_3006_3031_3046_6672',
    })
  })
})
