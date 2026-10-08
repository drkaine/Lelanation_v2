/**
 * Item damage the item data does not carry as numbers (descriptions only say "bonus damage").
 * Values follow the current item wiki; ids are Data Dragon item ids.
 */
import { emptySplit, type DamageSplit } from './theorycraftPracticeTool'

export interface ItemAttacker {
  level: number
  baseAD: number
  bonusAD: number
  AP: number
  maxHp: number
  ranged: boolean
}

export interface ItemTarget {
  maxHp: number
  currentHp: number
}

type OnHitRule = (attacker: ItemAttacker, target: ItemTarget) => Partial<DamageSplit>

const ON_HIT: Record<string, OnHitRule> = {
  // Recurve Bow
  '1043': () => ({ physical: 15 }),
  // Blade of the Ruined King: % current health
  '3153': (attacker, target) => ({
    physical: (attacker.ranged ? 0.06 : 0.09) * Math.max(0, target.currentHp),
  }),
  // Wit's End
  '3091': () => ({ magic: 45 }),
  // Nashor's Tooth
  '3115': attacker => ({ magic: 15 + 0.2 * attacker.AP }),
  // Guinsoo's Rageblade
  '3124': () => ({ magic: 30 }),
  // Terminus
  '3302': () => ({ magic: 30 }),
}

/** Spellblade does not stack: only the strongest one procs. */
const SPELLBLADE: Record<string, (attacker: ItemAttacker) => Partial<DamageSplit>> = {
  // Sheen
  '3057': attacker => ({ physical: attacker.baseAD }),
  // Trinity Force
  '3078': attacker => ({ physical: 2 * attacker.baseAD }),
  // Essence Reaver
  '3508': attacker => ({ physical: attacker.baseAD + 0.4 * attacker.bonusAD }),
  // Iceborn Gauntlet
  '6662': attacker => ({ physical: attacker.baseAD }),
  // Lich Bane
  '3100': attacker => ({ magic: 0.75 * attacker.baseAD + 0.45 * attacker.AP }),
}

function toSplit(partial: Partial<DamageSplit>): DamageSplit {
  return { ...emptySplit(), ...partial }
}

function total(split: DamageSplit): number {
  return split.physical + split.magic + split.true
}

/** Bonus damage added to every attack. */
export function onHitItemDamage(
  itemIds: string[],
  attacker: ItemAttacker,
  target: ItemTarget
): DamageSplit {
  const result = emptySplit()
  for (const id of itemIds) {
    const rule = ON_HIT[id]
    if (!rule) continue
    const split = toSplit(rule(attacker, target))
    result.physical += split.physical
    result.magic += split.magic
    result.true += split.true
  }
  return result
}

/** Bonus damage of the next attack after an ability. */
export function spellbladeDamage(itemIds: string[], attacker: ItemAttacker): DamageSplit {
  let best = emptySplit()
  for (const id of itemIds) {
    const rule = SPELLBLADE[id]
    if (!rule) continue
    const split = toSplit(rule(attacker))
    if (total(split) > total(best)) best = split
  }
  return best
}

/** Damage added to a damaging ability (Liandry's burn: 2% max HP per second for 3 s). */
export function abilityItemDamage(itemIds: string[], target: ItemTarget): DamageSplit {
  const result = emptySplit()
  if (itemIds.includes('6653')) result.magic += 0.06 * Math.max(0, target.maxHp)
  return result
}

/** Abyssal Mask (+12% magic taken) and Shadowflame (+20% magic/true under 40% health). */
export function amplifyItemDamage(
  itemIds: string[],
  split: DamageSplit,
  target: ItemTarget
): DamageSplit {
  let magic = 1
  let trueDamage = 1
  if (itemIds.includes('8020')) magic *= 1.12
  if (itemIds.includes('4645') && target.maxHp > 0 && target.currentHp < 0.4 * target.maxHp) {
    magic *= 1.2
    trueDamage *= 1.2
  }
  return { physical: split.physical, magic: split.magic * magic, true: split.true * trueDamage }
}
