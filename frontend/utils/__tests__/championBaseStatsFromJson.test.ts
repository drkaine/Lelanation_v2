import { describe, expect, it } from 'vitest'
import type { ChampionMiscStatRow } from '../championBaseStatsFromJson'
import {
  CHAMPION_MISC_MAX_LEVEL,
  championMiscManaUnavailable,
  championMiscStatValueAtLevel,
  clampChampionMiscLevel,
  computeChampionMiscStatAtLevel,
} from '../championMiscStatLevel'

const viegoRow: ChampionMiscStatRow = {
  championId: 234,
  championSlug: 'Viego',
  name: 'Viego',
  imageFull: 'Viego.png',
  partype: 'None',
  base: {
    hp: 630,
    hpRegen: 7,
    mp: 10000,
    mpRegen: 0,
    armor: 34,
    magicResist: 32,
    attackDamage: 57,
    attackSpeed: 0.658,
    attackRange: 200,
    movespeed: 345,
  },
  growth: {
    hp: 109,
    hpRegen: 0.7,
    mp: 0,
    mpRegen: 0,
    armor: 4.6,
    magicResist: 2.05,
    attackDamage: 0,
    attackSpeed: 2.75,
  },
}

describe('championMiscManaUnavailable', () => {
  it('flags Viego as having no mana pool', () => {
    expect(championMiscManaUnavailable(viegoRow)).toBe(true)
  })
})

describe('championMiscStatValueAtLevel', () => {
  it('scales health and attack speed at level 18', () => {
    expect(championMiscStatValueAtLevel(viegoRow, 'hp', 18)).toBe(630 + 109 * 17)
    expect(championMiscStatValueAtLevel(viegoRow, 'attackSpeed', 18)).toBeCloseTo(
      0.658 * (1 + (2.75 / 100) * 17),
      5
    )
  })

  it('keeps flat stats unchanged by level', () => {
    expect(championMiscStatValueAtLevel(viegoRow, 'movespeed', 18)).toBe(345)
    expect(championMiscStatValueAtLevel(viegoRow, 'attackRange', 18)).toBe(200)
  })
})

describe('computeChampionMiscStatAtLevel', () => {
  it('clamps invalid levels to 1', () => {
    expect(computeChampionMiscStatAtLevel('hp', 100, 10, 0)).toBe(100)
  })

  it('supports level 20', () => {
    expect(CHAMPION_MISC_MAX_LEVEL).toBe(20)
    expect(clampChampionMiscLevel(25)).toBe(20)
    expect(championMiscStatValueAtLevel(viegoRow, 'hp', 20)).toBe(630 + 109 * 19)
  })
})
