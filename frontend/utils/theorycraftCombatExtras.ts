/**
 * Combat effects outside spells: the target's defensive items, summoner spells, potions and
 * shields gained on hit. The numbers are not in the game data (descriptions only): curated values.
 */
import { type DamageSplit, type DummyState } from './theorycraftPracticeTool'

const PLATED_STEELCAPS = '3047'
const RANDUINS_OMEN = '3143'
const DEATHS_DANCE = '6333'
const ECLIPSE = '6692'

const GRIEVOUS_WOUNDS = 0.4

export interface DefenderHitContext {
  isAttack?: boolean
  crit?: boolean
  defenderRanged?: boolean
}

function scaleSplit(split: DamageSplit, factor: number): DamageSplit {
  return {
    physical: split.physical * factor,
    magic: split.magic * factor,
    true: split.true * factor,
  }
}

/** Damage the target takes now, and the part Death's Dance turns into a 3 s bleed. */
export function defenderMitigation(
  itemIds: string[],
  split: DamageSplit,
  context: DefenderHitContext
): { immediate: DamageSplit; deferred: number } {
  const ids = new Set(itemIds)
  let factor = 1
  if (context.isAttack && ids.has(PLATED_STEELCAPS)) factor *= 0.9
  if (context.crit && ids.has(RANDUINS_OMEN)) factor *= 0.7
  const taken = scaleSplit(split, factor)
  if (!ids.has(DEATHS_DANCE)) return { immediate: taken, deferred: 0 }
  const deferRatio = context.defenderRanged ? 0.1 : 0.3
  const total = taken.physical + taken.magic + taken.true
  return { immediate: scaleSplit(taken, 1 - deferRatio), deferred: total * deferRatio }
}

/** Ignite: true damage over 5 s. */
export function igniteTotalDamage(level: number): number {
  return 50 + 20 * level
}

export function summonerBarrierShield(level: number): number {
  return 87 + 18 * level
}

export function summonerHealAmount(level: number): number {
  return 66 + 14 * level
}

const SUMMONER_COOLDOWNS: Record<string, number> = {
  SummonerDot: 180,
  SummonerBarrier: 180,
  SummonerHeal: 240,
}

export function summonerCooldown(spellId: string): number | null {
  return SUMMONER_COOLDOWNS[spellId] ?? null
}

const CONSUMABLE_HEALS: Record<string, { total: number; duration: number }> = {
  '2003': { total: 120, duration: 15 },
  '2031': { total: 100, duration: 12 },
}

export function consumableHeal(itemId: string): { total: number; duration: number } | null {
  return CONSUMABLE_HEALS[itemId] ?? null
}

/** Heals the target (never above max health, never a dead target). */
export function healTarget(
  state: DummyState,
  amount: number,
  maxHp: number,
  grievous: boolean
): DummyState {
  if (state.hp <= 0) return { ...state }
  const healed = Math.max(0, amount) * (grievous ? 1 - GRIEVOUS_WOUNDS : 1)
  return { ...state, hp: Math.min(maxHp, state.hp + healed) }
}

/** Eclipse procs on the 2nd hit within 2 s (hit times in seconds, the last one is now). */
export function eclipseTriggered(hitTimes: number[], now: number): boolean {
  return hitTimes.filter(time => now - time <= 2 + 1e-6).length >= 2
}

/** Eclipse shield, gained when 2 hits land on a champion within 2 s. */
export function eclipseShield(
  itemIds: string[],
  attacker: { bonusAD: number; ranged: boolean }
): number {
  if (!itemIds.includes(ECLIPSE)) return 0
  return attacker.ranged ? 80 + 0.2 * attacker.bonusAD : 160 + 0.4 * attacker.bonusAD
}

/** Health regenerated over time (regen given per 5 s), never above max health or on a dead target. */
export function regenerateHp(
  state: DummyState,
  regenPer5: number,
  seconds: number,
  maxHp: number
): DummyState {
  if (state.hp <= 0) return { ...state }
  const gained = (Math.max(0, regenPer5) / 5) * Math.max(0, seconds)
  return { ...state, hp: Math.min(maxHp, state.hp + gained) }
}

/** Controls do not stack: each kind lasts as long as its longest effect. */
export function combineControlDurations(entries: Array<{ duration: number; kind: string }>): {
  duration: number
  hardDuration: number
  slowDuration: number
} {
  const longest = (list: Array<{ duration: number }>) =>
    list.reduce((max, entry) => Math.max(max, entry.duration), 0)
  return {
    duration: longest(entries),
    hardDuration: longest(
      entries.filter(entry => entry.kind === 'hard' || entry.kind === 'airborne')
    ),
    slowDuration: longest(entries.filter(entry => entry.kind === 'slow')),
  }
}
