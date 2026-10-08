/**
 * Rune and item procs triggered by hits on a champion (Dark Harvest, Electrocute, Stormsurge…).
 * Values follow the current wiki; ranges scale linearly from level 1 to 18.
 */
import { emptySplit, type DamageSplit } from './theorycraftPracticeTool'
import type { ItemAttacker } from './theorycraftItemEffects'

export type ProcId =
  | 'darkHarvest'
  | 'electrocute'
  | 'arcaneComet'
  | 'summonAery'
  | 'pressTheAttack'
  | 'scorch'
  | 'stormsurge'
  | 'blackfireTorch'

export interface ProcState {
  readyAt: Partial<Record<ProcId, number>>
  /** Times of the attacks / abilities counted by Electrocute and Press the Attack. */
  hitTimes: Partial<Record<ProcId, number[]>>
  /** Recent damage counted by Stormsurge. */
  damageWindow: { at: number; amount: number }[]
  /** Last Blackfire Torch tick already scheduled (a new ability refreshes the burn). */
  burnLastTick?: number
}

export interface ProcHit {
  at: number
  damage: number
  isAttack: boolean
  ability: boolean
  /** Damage over time: only health / damage based procs count it. */
  periodic: boolean
  /** Target health after the hit. */
  targetHp: number
  targetMaxHp: number
}

export interface ProcContext {
  runeIds: number[]
  itemIds: string[]
  attacker: ItemAttacker
  /** Dark Harvest souls. */
  souls: number
}

export interface ProcDamage {
  id: ProcId
  at: number
  split: DamageSplit
  /** Damage over time tick. */
  periodic?: boolean
}

export function createProcState(): ProcState {
  return { readyAt: {}, hitTimes: {}, damageWindow: [] }
}

function byLevel(level: number, min: number, max: number): number {
  const clamped = Math.min(18, Math.max(1, level))
  return min + ((max - min) * (clamped - 1)) / 17
}

function adaptive(attacker: ItemAttacker, amount: number): DamageSplit {
  const split = emptySplit()
  if (attacker.bonusAD > attacker.AP) split.physical = amount
  else split.magic = amount
  return split
}

function magic(amount: number): DamageSplit {
  return { ...emptySplit(), magic: amount }
}

/** Blackfire Torch: 10 (+1% AP) magic every 0.5 s for 3 s. */
const TORCH_TICK_SECONDS = 0.5
const TORCH_TICKS = 6

/** Full damage of one proc, before the target's resistances. */
function procAmount(id: ProcId, ctx: ProcContext): DamageSplit {
  const { attacker } = ctx
  switch (id) {
    case 'darkHarvest':
      return adaptive(
        attacker,
        byLevel(attacker.level, 30, 60) +
          11 * Math.max(0, ctx.souls) +
          0.1 * attacker.bonusAD +
          0.05 * attacker.AP
      )
    case 'electrocute':
      return adaptive(
        attacker,
        byLevel(attacker.level, 30, 220) + 0.1 * attacker.bonusAD + 0.05 * attacker.AP
      )
    case 'pressTheAttack':
      return adaptive(attacker, byLevel(attacker.level, 40, 180))
    case 'arcaneComet':
      return adaptive(
        attacker,
        byLevel(attacker.level, 30, 130) + 0.05 * attacker.bonusAD + 0.1 * attacker.AP
      )
    case 'summonAery':
      return adaptive(
        attacker,
        byLevel(attacker.level, 10, 50) + 0.1 * attacker.bonusAD + 0.05 * attacker.AP
      )
    case 'scorch':
      return magic(byLevel(attacker.level, 20, 40))
    case 'stormsurge':
      return magic(125 + 0.1 * attacker.AP)
    case 'blackfireTorch':
      return magic(TORCH_TICKS * (10 + 0.01 * attacker.AP))
  }
}

function hasProc(id: ProcId, ctx: ProcContext): boolean {
  if (id === 'stormsurge') return ctx.itemIds.includes('4646')
  if (id === 'blackfireTorch') return ctx.itemIds.includes('2503')
  const runeById: Record<string, number> = {
    darkHarvest: 8128,
    electrocute: 8112,
    pressTheAttack: 8005,
    arcaneComet: 8229,
    summonAery: 8214,
    scorch: 8237,
  }
  return ctx.runeIds.includes(runeById[id]!)
}

/** Procs a combo (each proc once) triggers, for the damage table. */
export function comboProcDamage(
  ctx: ProcContext,
  combo: { attacks: boolean; abilities: boolean }
): { id: ProcId; split: DamageSplit }[] {
  const any = combo.attacks || combo.abilities
  const triggered: Record<ProcId, boolean> = {
    darkHarvest: any,
    electrocute: any,
    pressTheAttack: combo.attacks,
    arcaneComet: combo.abilities,
    summonAery: any,
    scorch: combo.abilities,
    stormsurge: any,
    blackfireTorch: combo.abilities,
  }
  return (Object.keys(triggered) as ProcId[])
    .filter(id => triggered[id] && hasProc(id, ctx))
    .map(id => ({ id, split: procAmount(id, ctx) }))
}

function ready(state: ProcState, id: ProcId, at: number): boolean {
  return at + 1e-6 >= (state.readyAt[id] ?? 0)
}

/** Counts a hit for a "N hits within X s" proc; true when the proc fires. */
function countHit(state: ProcState, id: ProcId, at: number, needed: number, within: number) {
  const times = [...(state.hitTimes[id] ?? []).filter(time => at - time <= within), at]
  if (times.length < needed) {
    state.hitTimes[id] = times
    return false
  }
  state.hitTimes[id] = []
  return true
}

/** Procs fired by a hit that just landed on the target; updates the state. */
export function registerProcHit(state: ProcState, hit: ProcHit, ctx: ProcContext): ProcDamage[] {
  const procs: ProcDamage[] = []
  const runes = new Set(ctx.runeIds)
  const { at } = hit
  const fire = (id: ProcId, split: DamageSplit, cooldown: number, delay = 0) => {
    state.readyAt[id] = at + cooldown
    procs.push({ id, at: at + delay, split })
  }
  const direct = !hit.periodic && (hit.isAttack || hit.ability)

  if (
    runes.has(8128) &&
    hit.targetMaxHp > 0 &&
    hit.targetHp > 0 &&
    hit.targetHp < 0.5 * hit.targetMaxHp &&
    ready(state, 'darkHarvest', at)
  ) {
    fire('darkHarvest', procAmount('darkHarvest', ctx), 30)
  }

  if (runes.has(8112) && direct && ready(state, 'electrocute', at)) {
    if (countHit(state, 'electrocute', at, 3, 3)) {
      fire('electrocute', procAmount('electrocute', ctx), 20)
    }
  }

  if (runes.has(8005) && !hit.periodic && hit.isAttack && ready(state, 'pressTheAttack', at)) {
    if (countHit(state, 'pressTheAttack', at, 3, 4)) {
      fire('pressTheAttack', procAmount('pressTheAttack', ctx), 6)
    }
  }

  if (runes.has(8229) && !hit.periodic && hit.ability && ready(state, 'arcaneComet', at)) {
    fire('arcaneComet', procAmount('arcaneComet', ctx), 20, 0.5)
  }

  if (runes.has(8214) && direct && ready(state, 'summonAery', at)) {
    fire('summonAery', procAmount('summonAery', ctx), 2)
  }

  if (runes.has(8237) && !hit.periodic && hit.ability && ready(state, 'scorch', at)) {
    fire('scorch', procAmount('scorch', ctx), 10, 1)
  }

  if (ctx.itemIds.includes('4646') && hit.targetMaxHp > 0) {
    state.damageWindow = [
      ...state.damageWindow.filter(entry => at - entry.at <= 2.5),
      { at, amount: Math.max(0, hit.damage) },
    ]
    const dealt = state.damageWindow.reduce((sum, entry) => sum + entry.amount, 0)
    if (dealt >= 0.25 * hit.targetMaxHp && ready(state, 'stormsurge', at)) {
      state.damageWindow = []
      fire('stormsurge', procAmount('stormsurge', ctx), 30, 2)
    }
  }

  if (ctx.itemIds.includes('2503') && !hit.periodic && hit.ability) {
    const tick = magic(procAmount('blackfireTorch', ctx).magic / TORCH_TICKS)
    for (let index = 1; index <= TORCH_TICKS; index += 1) {
      const tickAt = at + index * TORCH_TICK_SECONDS
      if (tickAt <= (state.burnLastTick ?? -Infinity) + 1e-6) continue
      procs.push({ id: 'blackfireTorch', at: tickAt, split: { ...tick }, periodic: true })
      state.burnLastTick = tickAt
    }
  }

  return procs
}
