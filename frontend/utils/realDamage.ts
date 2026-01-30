/**
 * Calcul des dégâts réels après réduction par armure / résistance magique.
 * Formules LoL officielles.
 */
import type { CalculatedStats } from '~/types/build'

export interface EnemyTarget {
  health: number
  armor: number
  magicResist: number
}

/**
 * Calcule l'armure effective après pénétration (pourcentage puis lethality).
 * Formule: armor_eff = (1 - pen_pct) * armor - lethality * f(level)
 * f(level) = 0.6 + 0.4 * (level / 18) pour lethality
 */
function calculateEffectiveArmor(
  armor: number,
  armorPenetrationPercent: number,
  lethality: number,
  attackerLevel: number
): number {
  const lethalityFactor = 0.6 + 0.4 * (attackerLevel / 18)
  const afterPercentPen = (1 - armorPenetrationPercent) * armor
  const afterLethality = Math.max(0, afterPercentPen - lethality * lethalityFactor)
  return afterLethality
}

/**
 * Calcule la résistance magique effective après pénétration.
 */
function calculateEffectiveMagicResist(
  magicResist: number,
  magicPenetrationPercent: number
): number {
  return Math.max(0, (1 - magicPenetrationPercent) * magicResist)
}

/**
 * Calcule le facteur de réduction d'armure (0-1).
 * Formule LoL: facteur = 100 / (100 + armor_eff)
 */
function getArmorReductionFactor(armor: number): number {
  return 100 / (100 + armor)
}

/**
 * Calcule le facteur de réduction de résistance magique.
 */
function getMagicResistReductionFactor(magicResist: number): number {
  return 100 / (100 + magicResist)
}

/**
 * Calcule les dégâts physiques réels vs une cible.
 */
export function calculatePhysicalDamage(
  rawDamage: number,
  target: EnemyTarget,
  attackerStats: CalculatedStats,
  attackerLevel: number
): number {
  const effectiveArmor = calculateEffectiveArmor(
    target.armor,
    attackerStats.armorPenetration,
    attackerStats.lethality,
    attackerLevel
  )
  const factor = getArmorReductionFactor(effectiveArmor)
  return Math.round(rawDamage * factor)
}

/**
 * Calcule les dégâts magiques réels vs une cible.
 */
export function calculateMagicDamage(
  rawDamage: number,
  target: EnemyTarget,
  attackerStats: CalculatedStats
): number {
  const effectiveMR = calculateEffectiveMagicResist(
    target.magicResist,
    attackerStats.magicPenetration
  )
  const factor = getMagicResistReductionFactor(effectiveMR)
  return Math.round(rawDamage * factor)
}

/**
 * Calcule les dégâts vrais (pas de réduction).
 */
export function calculateTrueDamage(rawDamage: number): number {
  return Math.round(rawDamage)
}
