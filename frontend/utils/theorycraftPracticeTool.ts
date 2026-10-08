/**
 * Logique pure de l'outil d'entraînement theorycraft :
 * mitigation par type de dégâts, cumul P/M/T, mannequin (bouclier puis PV), DPS.
 */

export type DamageType = 'physical' | 'magic' | 'true'

export type DamageSplit = Record<DamageType, number>

export const DAMAGE_TYPES: readonly DamageType[] = ['physical', 'magic', 'true']

export interface DefenderStats {
  armor?: number
  magicResist?: number
  damageReduction?: number
}

export interface AttackerPenetration {
  armorPenetration?: number
  flatArmorPenetration?: number
  lethality?: number
  percentLethality?: number
  magicPenetration?: number
  flatMagicPenetration?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function resistMultiplier(effective: number): number {
  return effective >= 0 ? 100 / (100 + effective) : 2 - 100 / (100 - effective)
}

export function mitigateDamage(
  rawDamage: number,
  damageType: DamageType,
  target: DefenderStats,
  attacker?: AttackerPenetration | Record<string, number> | null,
  attackerLevel = 18
): number {
  const raw = Number(rawDamage)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  const a = (attacker ?? {}) as AttackerPenetration
  let mitigated = raw
  if (damageType === 'physical') {
    const level = clamp(num(attackerLevel) || 1, 1, 18)
    const pct = clamp(num(a.armorPenetration), 0, 1)
    const lethality =
      Math.max(0, num(a.lethality)) *
      (0.6 + 0.4 * (level / 18)) *
      (1 + clamp(num(a.percentLethality), 0, 1))
    const armor = Math.max(
      0,
      (1 - pct) * num(target.armor) - Math.max(0, num(a.flatArmorPenetration)) - lethality
    )
    mitigated = raw * resistMultiplier(armor)
  } else if (damageType === 'magic') {
    const pct = clamp(num(a.magicPenetration), 0, 1)
    const mr = Math.max(
      0,
      (1 - pct) * num(target.magicResist) - Math.max(0, num(a.flatMagicPenetration))
    )
    mitigated = raw * resistMultiplier(mr)
  }
  mitigated *= 1 - clamp(num(target.damageReduction), 0, 0.95)
  return Math.max(0, mitigated)
}

export function emptySplit(): DamageSplit {
  return { physical: 0, magic: 0, true: 0 }
}

export function addSplit(a: DamageSplit, b: DamageSplit): DamageSplit {
  return {
    physical: a.physical + b.physical,
    magic: a.magic + b.magic,
    true: a.true + b.true,
  }
}

export function scaleSplit(split: DamageSplit, factor: number): DamageSplit {
  return {
    physical: split.physical * factor,
    magic: split.magic * factor,
    true: split.true * factor,
  }
}

export function sumSplit(split: DamageSplit): number {
  return split.physical + split.magic + split.true
}

export function mitigateSplit(
  raw: DamageSplit,
  target: DefenderStats,
  attacker?: AttackerPenetration | Record<string, number> | null,
  attackerLevel = 18
): DamageSplit {
  return {
    physical: mitigateDamage(raw.physical, 'physical', target, attacker, attackerLevel),
    magic: mitigateDamage(raw.magic, 'magic', target, attacker, attackerLevel),
    true: mitigateDamage(raw.true, 'true', target, attacker, attackerLevel),
  }
}

/** Part de chaque type en pourcentage (0 si aucun dégât). */
export function splitShares(split: DamageSplit): DamageSplit {
  const total = sumSplit(split)
  if (total <= 0) return emptySplit()
  return scaleSplit(split, 100 / total)
}

export function dominantDamageType(split: DamageSplit): DamageType | null {
  let best: DamageType | null = null
  for (const type of DAMAGE_TYPES) {
    if (split[type] > 0 && (best == null || split[type] > split[best])) best = type
  }
  return best
}

export interface DummyState {
  hp: number
  shield: number
}

export function applyHitToDummy(
  state: DummyState,
  amount: number
): DummyState & { absorbed: number; hpLost: number } {
  let remaining = Math.max(0, num(amount))
  const absorbed = Math.min(Math.max(0, state.shield), remaining)
  remaining -= absorbed
  const hpLost = Math.min(Math.max(0, state.hp), remaining)
  return {
    hp: Math.max(0, state.hp - hpLost),
    shield: Math.max(0, state.shield - absorbed),
    absorbed,
    hpLost,
  }
}

export function dpsOf(totalDamage: number, elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0
  return Math.max(0, totalDamage) / elapsedSeconds
}

export interface DummyBarInput extends DummyState {
  maxHp: number
  maxShield: number
  dealt: DamageSplit
}

/** Largeurs (en %) de la barre du mannequin : PV restants, bouclier restant, dégâts subis par type. */
export function buildDummyBar(input: DummyBarInput): {
  hp: number
  shield: number
  lost: DamageSplit
} {
  const total = Math.max(0, input.maxHp) + Math.max(0, input.maxShield)
  if (total <= 0) return { hp: 0, shield: 0, lost: emptySplit() }
  const hp = (clamp(input.hp, 0, total) / total) * 100
  const shield = (clamp(input.shield, 0, total) / total) * 100
  const lostPct = Math.max(0, 100 - hp - shield)
  const dealt = sumSplit(input.dealt)
  const lost = dealt > 0 ? scaleSplit(input.dealt, lostPct / dealt) : emptySplit()
  return { hp, shield, lost }
}
