import { describe, expect, it } from 'vitest'
import { synergyLaneScore, synergyLaneZ } from '../../../../src/services/synergyLaneScore.js'

const row = (champion_id: number, games: number, v: number) => ({
  champion_id,
  games: BigInt(games),
  sum_level: v * games,
  sum_kill_def: v * games,
  sum_cs: v * games,
  sum_vision: v * games,
  sum_laning: v * games,
  sum_early: v * games,
})

describe('synergyLaneZ', () => {
  it('scores each lane axis against the other champions of the cohort', () => {
    const me = row(1, 10, 3)
    const peers = [row(1, 10, 3), row(2, 10, 1), row(3, 10, 2), row(4, 2, 50)]
    const { z, cohortSize } = synergyLaneZ(me, peers, 1)
    expect(cohortSize).toBe(2)
    expect(z.level).toBeCloseTo(2.12, 2)
    expect(z.kills).toBeCloseTo(-2.12, 2)
    expect(z.early).toBeCloseTo(2.12, 2)
  })

  it('is not clamped (legacy: no spread divides by 1e-9)', () => {
    const peers = [row(2, 10, 1), row(3, 10, 1.001)]
    expect(synergyLaneZ(row(1, 10, 30), peers, 1).z.level).toBeGreaterThan(3)
    expect(synergyLaneZ(row(1, 10, 3), [], 1).z.cs).toBeCloseTo(3e9, -3)
  })
})

describe('synergyLaneScore', () => {
  it('averages the axes, rounded to 2 decimals', () => {
    expect(
      synergyLaneScore({ level: 1, kills: -1, cs: 0.5, vision: 0.5, laneEconomy: 0, early: 0.333 })
    ).toBe(0.22)
  })
})
