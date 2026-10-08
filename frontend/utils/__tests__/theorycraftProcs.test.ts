import { describe, expect, it } from 'vitest'
import {
  comboProcDamage,
  createProcState,
  registerProcHit,
  type ProcContext,
  type ProcHit,
} from '../theorycraftProcs'

const attacker = { level: 1, baseAD: 60, bonusAD: 0, AP: 100, maxHp: 1000, ranged: false }

function ctx(overrides: Partial<ProcContext> = {}): ProcContext {
  return { runeIds: [], itemIds: [], attacker, souls: 0, ...overrides }
}

function hit(overrides: Partial<ProcHit> = {}): ProcHit {
  return {
    at: 0,
    damage: 50,
    isAttack: false,
    ability: true,
    periodic: false,
    targetHp: 2000,
    targetMaxHp: 2000,
    ...overrides,
  }
}

describe('registerProcHit', () => {
  it('Dark Harvest procs once the target falls under half health, souls included', () => {
    const state = createProcState()
    const context = ctx({ runeIds: [8128], souls: 10 })
    expect(registerProcHit(state, hit({ targetHp: 1200 }), context)).toEqual([])
    const procs = registerProcHit(state, hit({ at: 1, targetHp: 900 }), context)
    // 30 (level 1) + 11 × 10 souls + 5% AP
    expect(procs).toHaveLength(1)
    expect(procs[0]!.id).toBe('darkHarvest')
    expect(procs[0]!.split.magic).toBeCloseTo(30 + 110 + 5)
    expect(registerProcHit(state, hit({ at: 2, targetHp: 800 }), context)).toEqual([])
  })

  it('Dark Harvest deals physical damage when bonus AD outweighs AP', () => {
    const procs = registerProcHit(
      createProcState(),
      hit({ targetHp: 100 }),
      ctx({ runeIds: [8128], attacker: { ...attacker, bonusAD: 200, AP: 0 } })
    )
    expect(procs[0]!.split.physical).toBeCloseTo(30 + 20)
  })

  it('Electrocute needs three separate attacks or abilities within 3 s', () => {
    const state = createProcState()
    const context = ctx({ runeIds: [8112] })
    expect(registerProcHit(state, hit({ at: 0 }), context)).toEqual([])
    expect(
      registerProcHit(state, hit({ at: 0.5, periodic: true, ability: false }), context)
    ).toEqual([])
    expect(registerProcHit(state, hit({ at: 1, isAttack: true, ability: false }), context)).toEqual(
      []
    )
    const procs = registerProcHit(state, hit({ at: 2 }), context)
    expect(procs[0]!.id).toBe('electrocute')
    expect(procs[0]!.split.magic).toBeCloseTo(30 + 5)
    expect(registerProcHit(state, hit({ at: 2.5 }), context)).toEqual([])
  })

  it('Electrocute does not proc when the hits are too far apart', () => {
    const state = createProcState()
    const context = ctx({ runeIds: [8112] })
    registerProcHit(state, hit({ at: 0 }), context)
    registerProcHit(state, hit({ at: 2 }), context)
    expect(registerProcHit(state, hit({ at: 4 }), context)).toEqual([])
  })

  it('Stormsurge strikes 2 s after 25% max health dealt within 2.5 s', () => {
    const state = createProcState()
    const context = ctx({ itemIds: ['4646'] })
    expect(registerProcHit(state, hit({ at: 0, damage: 300 }), context)).toEqual([])
    const procs = registerProcHit(state, hit({ at: 2, damage: 250 }), context)
    expect(procs).toHaveLength(1)
    expect(procs[0]!.id).toBe('stormsurge')
    expect(procs[0]!.at).toBeCloseTo(4)
    expect(procs[0]!.split.magic).toBeCloseTo(125 + 10)
    expect(registerProcHit(state, hit({ at: 3, damage: 600 }), context)).toEqual([])
  })

  it('Stormsurge ignores damage older than 2.5 s', () => {
    const state = createProcState()
    const context = ctx({ itemIds: ['4646'] })
    registerProcHit(state, hit({ at: 0, damage: 300 }), context)
    expect(registerProcHit(state, hit({ at: 3, damage: 250 }), context)).toEqual([])
  })

  it('Arcane Comet and Scorch proc on abilities, not on attacks', () => {
    const context = ctx({ runeIds: [8229, 8237] })
    expect(
      registerProcHit(createProcState(), hit({ isAttack: true, ability: false }), context)
    ).toEqual([])
    const procs = registerProcHit(createProcState(), hit({ at: 1 }), context)
    expect(procs.map(proc => proc.id).sort()).toEqual(['arcaneComet', 'scorch'])
    const scorch = procs.find(proc => proc.id === 'scorch')!
    expect(scorch.at).toBeCloseTo(2)
    expect(scorch.split.magic).toBeCloseTo(20)
  })

  it('Press the Attack procs on the third consecutive attack', () => {
    const state = createProcState()
    const context = ctx({ runeIds: [8005] })
    const attack = { isAttack: true, ability: false }
    registerProcHit(state, hit({ at: 0, ...attack }), context)
    registerProcHit(state, hit({ at: 1, ...attack }), context)
    const procs = registerProcHit(state, hit({ at: 2, ...attack }), context)
    expect(procs[0]!.id).toBe('pressTheAttack')
    expect(procs[0]!.split.magic).toBeCloseTo(40)
  })

  it('without a proc rune or item nothing happens', () => {
    expect(registerProcHit(createProcState(), hit({ targetHp: 1 }), ctx())).toEqual([])
  })
})

describe('Blackfire Torch', () => {
  it('burns for 10 + 1% AP every 0.5 s over 3 s after an ability', () => {
    const procs = registerProcHit(
      createProcState(),
      hit({ ability: true }),
      ctx({ itemIds: ['2503'] })
    )
    expect(procs.map(proc => proc.at)).toEqual([0.5, 1, 1.5, 2, 2.5, 3])
    expect(procs.every(proc => proc.id === 'blackfireTorch' && proc.periodic)).toBe(true)
    expect(procs[0]!.split.magic).toBeCloseTo(11)
  })

  it('a new ability refreshes the burn without doubling the ticks', () => {
    const state = createProcState()
    const context = ctx({ itemIds: ['2503'] })
    registerProcHit(state, hit({ ability: true }), context)
    const refresh = registerProcHit(state, hit({ ability: true, at: 1 }), context)
    expect(refresh.map(proc => proc.at)).toEqual([3.5, 4])
  })

  it('attacks do not burn', () => {
    expect(
      registerProcHit(
        createProcState(),
        hit({ isAttack: true, ability: false }),
        ctx({ itemIds: ['2503'] })
      )
    ).toEqual([])
  })
})

describe('comboProcDamage', () => {
  it('lists each proc of the build once with its full damage', () => {
    const procs = comboProcDamage(ctx({ runeIds: [8128], itemIds: ['2503'], souls: 2 }), {
      attacks: true,
      abilities: true,
    })
    expect(procs.map(proc => proc.id)).toEqual(['darkHarvest', 'blackfireTorch'])
    expect(procs[0]!.split.magic).toBeCloseTo(30 + 22 + 5)
    expect(procs[1]!.split.magic).toBeCloseTo(66)
  })

  it('skips ability procs without abilities', () => {
    const procs = comboProcDamage(ctx({ runeIds: [8229], itemIds: ['2503'] }), {
      attacks: true,
      abilities: false,
    })
    expect(procs).toEqual([])
  })
})
