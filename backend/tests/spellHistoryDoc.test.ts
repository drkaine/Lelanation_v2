import { describe, expect, it } from 'vitest'
import {
  buildSpellHistoryDocFromEvents,
  spellOrderFromHistoryDoc,
  spellTimestampSumFromHistoryDoc,
} from '../src/parsers/spellHistoryDoc.js'

describe('spellHistoryDoc', () => {
  it('builds full order from SKILL_LEVEL_UP events', () => {
    const doc = buildSpellHistoryDocFromEvents(
      [
        { type: 'SKILL_LEVEL_UP', participantId: 3, skillSlot: 1, timestamp: 1000 },
        { type: 'SKILL_LEVEL_UP', participantId: 3, skillSlot: 2, timestamp: 2000 },
        { type: 'SKILL_LEVEL_UP', participantId: 3, skillSlot: 1, timestamp: 3000 },
        { type: 'SKILL_LEVEL_UP', participantId: 4, skillSlot: 1, timestamp: 4000 },
      ],
      3
    )
    expect(doc.order).toBe('1-2-1')
    expect(doc.sumTimestampMs).toBe(6000)
  })

  it('reads explicit order from new JSON doc', () => {
    expect(
      spellOrderFromHistoryDoc({
        order: '1-2-1-3-1-4',
        sumTimestampMs: 900000,
      })
    ).toBe('1-2-1-3-1-4')
    expect(spellTimestampSumFromHistoryDoc({ order: '1-2', sumTimestampMs: 900000 })).toBe(900000)
  })

  it('ignores legacy flat slot map without order key', () => {
    expect(spellOrderFromHistoryDoc({ '1': 1000, '2': 2000, '3': 3000 })).toBe('')
  })
})
