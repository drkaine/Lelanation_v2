import { describe, expect, it } from 'vitest'
import type { RuneSelection } from '@lelanation/shared-types'
import {
  applyTheorycraftRuneModifiers,
  getTheorycraftRuneStackStats,
  listSelectedRuneIds,
  runeSelectionUsesGameDuration,
} from '../theorycraftRuneModifiers'
import { makeCalculatedStats } from './fixtures/calculatedStats'

const baseStats = makeCalculatedStats({
  health: 2000,
  mana: 500,
  attackDamage: 100,
  abilityPower: 200,
  armor: 80,
  magicResist: 50,
  movementSpeed: 335,
})

const sampleRunes: RuneSelection = {
  primary: { pathId: 8100, keystone: 8128, slot1: 8126, slot2: 8138, slot3: 8135 },
  secondary: { pathId: 8200, slot1: 8226, slot2: 8236 },
}

describe('theorycraftRuneModifiers', () => {
  it('lists selected rune ids', () => {
    expect(listSelectedRuneIds(sampleRunes)).toContain(8128)
    expect(listSelectedRuneIds(sampleRunes)).toContain(8226)
    expect(listSelectedRuneIds(sampleRunes)).toContain(8236)
  })

  it('coerces string rune ids from persisted builds', () => {
    const runes = {
      primary: {
        pathId: 8400,
        keystone: '8437',
        slot1: '8446',
        slot2: '8451',
        slot3: 0,
      },
      secondary: {
        pathId: 8100,
        slot1: '9111',
        slot2: '8429',
      },
    } as unknown as RuneSelection
    expect(listSelectedRuneIds(runes)).toContain(8429)
    expect(runeSelectionUsesGameDuration(listSelectedRuneIds(runes))).toBe(true)
  })

  it('adds manaflow mana per stack', () => {
    expect(getTheorycraftRuneStackStats(8226, 10, 18, 'ap').mana).toBe(250)
  })

  it('adds grasp health per stack', () => {
    expect(getTheorycraftRuneStackStats(8437, 12, 18, 'ad').health).toBe(60)
  })

  it('does not cap grasp stacks above the old UI limit', () => {
    expect(getTheorycraftRuneStackStats(8437, 80, 18, 'ad').health).toBe(400)
  })

  it('detects runes that use game duration', () => {
    expect(runeSelectionUsesGameDuration([8236])).toBe(true)
    expect(runeSelectionUsesGameDuration([8429])).toBe(true)
    expect(runeSelectionUsesGameDuration([8226])).toBe(false)
  })

  it('applies conditioning after 12 minutes', () => {
    const runes: RuneSelection = {
      primary: { pathId: 8400, keystone: 8437, slot1: 8446, slot2: 8451, slot3: 8444 },
      secondary: { pathId: 8100, slot1: 9111, slot2: 8429 },
    }
    const before12 = applyTheorycraftRuneModifiers({
      stats: baseStats,
      runes,
      shards: null,
      runeStacksById: {},
      level: 18,
      gameDurationMinutes: 11,
      adaptive: 'ad',
      labels: {},
    })
    expect(before12.stats.armor).toBe(baseStats.armor)
    expect(before12.lines.some(line => line.runeId === 8429)).toBe(false)

    const at12 = applyTheorycraftRuneModifiers({
      stats: baseStats,
      runes,
      shards: null,
      runeStacksById: {},
      level: 18,
      gameDurationMinutes: 12,
      adaptive: 'ad',
      labels: {},
    })
    expect(at12.stats.armor).toBeGreaterThan(baseStats.armor)
    expect(at12.stats.magicResist).toBeGreaterThan(baseStats.magicResist)
    expect(at12.lines.some(line => line.runeId === 8429)).toBe(true)
  })

  it('applies rune stacks and gathering storm in modifier pass', () => {
    const result = applyTheorycraftRuneModifiers({
      stats: baseStats,
      runes: sampleRunes,
      shards: { slot1: 5008, slot2: 5001, slot3: 5011 },
      runeStacksById: { '8226': 10 },
      level: 18,
      gameDurationMinutes: 30,
      adaptive: 'ap',
      labels: {},
    })
    expect(result.stats.mana).toBe(750)
    expect(result.stats.abilityPower).toBe(248)
    expect(result.lines.some(line => line.runeId === 8226)).toBe(true)
    expect(result.lines.some(line => line.runeId === 8236)).toBe(true)
  })
})
