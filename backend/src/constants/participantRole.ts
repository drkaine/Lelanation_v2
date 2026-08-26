import { normalizeLolRole, type LolRole } from './lolEnums.js'

/** Riot participantId → lane on Summoner's Rift (1–5 blue, 6–10 red). */
const ROLE_BY_PARTICIPANT_ID: Record<number, LolRole> = {
  1: 'TOP',
  2: 'JUNGLE',
  3: 'MIDDLE',
  4: 'BOTTOM',
  5: 'UTILITY',
  6: 'TOP',
  7: 'JUNGLE',
  8: 'MIDDLE',
  9: 'BOTTOM',
  10: 'UTILITY',
}

export function lolRoleFromParticipantId(participantId: number): LolRole | null {
  const id = Math.trunc(participantId)
  return ROLE_BY_PARTICIPANT_ID[id] ?? null
}

export function lolOpponentParticipantId(participantId: number): number | null {
  const id = Math.trunc(participantId)
  if (id >= 1 && id <= 5) return id + 5
  if (id >= 6 && id <= 10) return id - 5
  return null
}

/** Lane slot within team (0 = top … 4 = support) from fixed participantId order. */
export function laneSlotFromParticipantId(participantId: number, teamId: 100 | 200): number {
  const id = Math.trunc(participantId)
  if (teamId === 100 && id >= 1 && id <= 5) return id - 1
  if (teamId === 200 && id >= 6 && id <= 10) return id - 6
  return -1
}

/** Pick order 1–5 within team draft slot (matches participantId order on SR). */
export function pickOrderFromParticipantId(participantId: number, teamId: 100 | 200): number {
  const slot = laneSlotFromParticipantId(participantId, teamId)
  return slot >= 0 ? slot + 1 : 0
}

/** Prefer fixed participantId lane; fall back to Riot teamPosition when id is out of range. */
export function resolveParticipantRole(
  participantId: number,
  teamPosition?: string | null
): LolRole {
  return lolRoleFromParticipantId(participantId) ?? normalizeLolRole(teamPosition)
}
