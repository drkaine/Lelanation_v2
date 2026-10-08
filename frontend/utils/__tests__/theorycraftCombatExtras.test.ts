import { describe, expect, it } from 'vitest'
import {
  combineControlDurations,
  consumableHeal,
  defenderMitigation,
  eclipseShield,
  eclipseTriggered,
  summonerCooldown,
  healTarget,
  regenerateHp,
  igniteTotalDamage,
  summonerBarrierShield,
  summonerHealAmount,
} from '../theorycraftCombatExtras'

const split = (physical: number, magic = 0, trueDmg = 0) => ({ physical, magic, true: trueDmg })

describe('defenderMitigation', () => {
  it('passes damage through without defensive items', () => {
    expect(defenderMitigation([], split(100), { isAttack: true, crit: true })).toEqual({
      immediate: split(100),
      deferred: 0,
    })
  })

  it('Plated Steelcaps reduce attack damage by 10%', () => {
    const result = defenderMitigation(['3047'], split(100, 20), { isAttack: true })
    expect(result.immediate.physical).toBeCloseTo(90)
    expect(result.immediate.magic).toBeCloseTo(18)
    expect(defenderMitigation(['3047'], split(100), { isAttack: false }).immediate.physical).toBe(
      100
    )
  })

  it("Randuin's Omen reduces critical strikes by 30%", () => {
    expect(
      defenderMitigation(['3143'], split(200), { isAttack: true, crit: true }).immediate.physical
    ).toBeCloseTo(140)
    expect(
      defenderMitigation(['3143'], split(200), { isAttack: true, crit: false }).immediate.physical
    ).toBe(200)
  })

  it("Death's Dance defers 30% (melee) or 10% (ranged) of the damage", () => {
    const melee = defenderMitigation(['6333'], split(100, 100), {})
    expect(melee.immediate.physical).toBeCloseTo(70)
    expect(melee.immediate.magic).toBeCloseTo(70)
    expect(melee.deferred).toBeCloseTo(60)
    expect(defenderMitigation(['6333'], split(100), { defenderRanged: true }).deferred).toBeCloseTo(
      10
    )
  })
})

describe('summoner spells', () => {
  it('Ignite deals 50 + 20 per level', () => {
    expect(igniteTotalDamage(1)).toBe(70)
    expect(igniteTotalDamage(18)).toBe(410)
  })

  it('Barrier and Heal scale with level', () => {
    expect(summonerBarrierShield(1)).toBe(105)
    expect(summonerBarrierShield(18)).toBe(411)
    expect(summonerHealAmount(1)).toBe(80)
    expect(summonerHealAmount(18)).toBe(318)
  })
})

describe('summonerCooldown', () => {
  it('reads curated cooldowns, null for unknown spells', () => {
    expect(summonerCooldown('SummonerDot')).toBe(180)
    expect(summonerCooldown('SummonerBarrier')).toBe(180)
    expect(summonerCooldown('SummonerHeal')).toBe(240)
    expect(summonerCooldown('SummonerFlash')).toBeNull()
  })
})

describe('eclipseTriggered', () => {
  it('needs 2 hits within 2 seconds', () => {
    expect(eclipseTriggered([1, 2.5], 2.5)).toBe(true)
    expect(eclipseTriggered([0, 2.5], 2.5)).toBe(false)
    expect(eclipseTriggered([2.5], 2.5)).toBe(false)
  })
})

describe('consumableHeal', () => {
  it('reads potion heal and duration', () => {
    expect(consumableHeal('2003')).toEqual({ total: 120, duration: 15 })
    expect(consumableHeal('2031')).toEqual({ total: 100, duration: 12 })
    expect(consumableHeal('1055')).toBeNull()
  })
})

describe('healTarget', () => {
  it('heals up to max health, reduced by 40% under grievous wounds', () => {
    expect(healTarget({ hp: 900, shield: 0 }, 200, 1000, false).hp).toBe(1000)
    expect(healTarget({ hp: 500, shield: 0 }, 100, 1000, true).hp).toBe(560)
  })

  it('does not revive a dead target', () => {
    expect(healTarget({ hp: 0, shield: 0 }, 100, 1000, false).hp).toBe(0)
  })
})

describe('eclipseShield', () => {
  it('gives 160 + 40% bonus AD (melee), 80 + 20% (ranged)', () => {
    expect(eclipseShield(['6692'], { bonusAD: 100, ranged: false })).toBeCloseTo(200)
    expect(eclipseShield(['6692'], { bonusAD: 100, ranged: true })).toBeCloseTo(100)
    expect(eclipseShield([], { bonusAD: 100, ranged: false })).toBe(0)
  })
})

describe('regenerateHp', () => {
  it('regenerates health per 5 s over the elapsed time, capped at max health', () => {
    expect(regenerateHp({ hp: 500, shield: 0 }, 50, 2, 1000).hp).toBeCloseTo(520)
    expect(regenerateHp({ hp: 995, shield: 0 }, 50, 5, 1000).hp).toBe(1000)
  })

  it('does not revive a dead target and ignores negative values', () => {
    expect(regenerateHp({ hp: 0, shield: 0 }, 50, 5, 1000).hp).toBe(0)
    expect(regenerateHp({ hp: 500, shield: 0 }, -10, 5, 1000).hp).toBe(500)
  })
})

describe('combineControlDurations', () => {
  it('does not stack controls: the longest of each kind wins', () => {
    expect(
      combineControlDurations([
        { duration: 1, kind: 'hard' },
        { duration: 1.5, kind: 'airborne' },
        { duration: 2, kind: 'slow' },
        { duration: 1, kind: 'slow' },
      ])
    ).toEqual({ duration: 2, hardDuration: 1.5, slowDuration: 2 })
  })

  it('returns zeros without controls', () => {
    expect(combineControlDurations([])).toEqual({ duration: 0, hardDuration: 0, slowDuration: 0 })
  })
})
