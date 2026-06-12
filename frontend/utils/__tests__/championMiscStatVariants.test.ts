import { describe, expect, it } from 'vitest'
import type { ChampionMiscStatRow } from '../championBaseStatsFromJson'
import {
  championMiscRowMatchesSearch,
  deriveSkaarlHpStats,
  expandKledMiscStatRows,
  KLED_CHAMPION_ID,
} from '../championMiscStatVariants'

const baseKledRow: ChampionMiscStatRow = {
  championId: KLED_CHAMPION_ID,
  championSlug: 'Kled',
  name: 'Kled',
  imageFull: 'Kled.png',
  partype: 'Courage',
  base: {
    hp: 410,
    hpRegen: 6,
    mp: 100,
    mpRegen: 0,
    armor: 35,
    magicResist: 28,
    attackDamage: 65,
    attackSpeed: 0.625,
    attackRange: 125,
    movespeed: 345,
  },
  growth: {
    hp: 84,
    hpRegen: 0.75,
    mp: 0,
    mpRegen: 0,
    armor: 5.2,
    magicResist: 2.05,
    attackDamage: 0,
    attackSpeed: 3.5,
  },
}

const kledPassive = {
  calculations: [
    {
      key: 'skaarlhealth',
      baseValues: [400, 635.29, 870.59, 1105.88, 1341.18],
    },
  ],
  dataValues: [{ name: 'DismountedMSPenalty', values: [40] }],
}

describe('deriveSkaarlHpStats', () => {
  it('derives base and per-level growth from passive', () => {
    const stats = deriveSkaarlHpStats(kledPassive)
    expect(stats.base).toBe(400)
    expect(stats.growth).toBeCloseTo(58.8225, 3)
  })
})

describe('expandKledMiscStatRows', () => {
  it('returns three variants with expected HP and movement stats', () => {
    const rows = expandKledMiscStatRows(baseKledRow, { passive: kledPassive })
    expect(rows).toHaveLength(3)

    const kled = rows.find(r => r.variant === 'kled')!
    const skaarl = rows.find(r => r.variant === 'skaarl')!
    const duo = rows.find(r => r.variant === 'duo')!

    expect(kled.base.hp).toBe(410)
    expect(kled.base.movespeed).toBe(305)
    expect(kled.base.attackRange).toBe(250)

    expect(skaarl.base.hp).toBe(400)
    expect(skaarl.growth.hp).toBeCloseTo(58.8225, 3)

    expect(duo.base.hp).toBe(810)
    expect(duo.growth.hp).toBeCloseTo(142.8225, 3)
    expect(duo.base.movespeed).toBe(345)
    expect(duo.base.attackRange).toBe(125)
  })
})

describe('championMiscRowMatchesSearch', () => {
  const rows = expandKledMiscStatRows(baseKledRow, { passive: kledPassive })

  it('filters by variant-specific terms', () => {
    expect(rows.filter(r => championMiscRowMatchesSearch(r, 'skaarl'))).toHaveLength(1)
    expect(rows.filter(r => championMiscRowMatchesSearch(r, 'duo'))).toHaveLength(1)
    expect(rows.filter(r => championMiscRowMatchesSearch(r, 'kled'))).toHaveLength(3)
  })
})
