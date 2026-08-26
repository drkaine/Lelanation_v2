import { describe, expect, it } from 'vitest'
import {
  laneSlotFromParticipantId,
  lolOpponentParticipantId,
  lolRoleFromParticipantId,
  pickOrderFromParticipantId,
  resolveParticipantRole,
} from '../../../src/constants/participantRole.js'

describe('participantRole', () => {
  it('maps participant ids to lanes', () => {
    expect(lolRoleFromParticipantId(1)).toBe('TOP')
    expect(lolRoleFromParticipantId(2)).toBe('JUNGLE')
    expect(lolRoleFromParticipantId(3)).toBe('MIDDLE')
    expect(lolRoleFromParticipantId(4)).toBe('BOTTOM')
    expect(lolRoleFromParticipantId(5)).toBe('UTILITY')
    expect(lolRoleFromParticipantId(6)).toBe('TOP')
    expect(lolRoleFromParticipantId(10)).toBe('UTILITY')
  })

  it('maps lane opponents by participant id', () => {
    expect(lolOpponentParticipantId(1)).toBe(6)
    expect(lolOpponentParticipantId(4)).toBe(9)
    expect(lolOpponentParticipantId(7)).toBe(2)
    expect(lolOpponentParticipantId(10)).toBe(5)
  })

  it('derives team slot and pick order from participant id', () => {
    expect(laneSlotFromParticipantId(3, 100)).toBe(2)
    expect(pickOrderFromParticipantId(3, 100)).toBe(3)
    expect(laneSlotFromParticipantId(8, 200)).toBe(2)
    expect(pickOrderFromParticipantId(8, 200)).toBe(3)
  })

  it('falls back to teamPosition when participant id is unknown', () => {
    expect(resolveParticipantRole(99, 'MID')).toBe('MIDDLE')
    expect(resolveParticipantRole(2, 'TOP')).toBe('JUNGLE')
  })
})
