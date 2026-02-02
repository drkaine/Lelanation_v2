/**
 * Types for the theorycraft engine (CommunityDragon + Data Dragon).
 * Used for computing real champion stats and spell damage/cooldowns/costs.
 */

/** Base stats per level (Data Dragon format). Re-exported from build for engine use. */
export type { ChampionStats } from '~/types/build'

/**
 * Champion stats at a specific level.
 * Formula: stat = base + (level - 1) * perLevel (AS uses percent growth).
 */
export interface ChampionLevelStats {
  level: number
  hp: number
  hpRegen: number
  mana: number
  manaRegen: number
  attackDamage: number
  attackSpeed: number
  armor: number
  magicResist: number
  movementSpeed: number
  attackRange: number
  /** For spell damage; 0 when no items/runes. */
  abilityPower?: number
}

/**
 * Scaling coefficients for a spell (normalized from CommunityDragon/DDragon).
 * All ratios are 0–1 scale (e.g. 0.7 = 70% AP).
 */
export interface SpellScaling {
  /** Total AD ratio */
  adRatio?: number
  /** Bonus AD ratio */
  bonusAdRatio?: number
  /** AP ratio */
  apRatio?: number
  /** Target max HP % (e.g. 0.15 = 15% max HP) */
  targetHpRatio?: number
  /** Target current HP % */
  targetCurrentHpRatio?: number
}

/**
 * Normalized spell definition (from CommunityDragon + optional DDragon fallback).
 */
export interface SpellDefinition {
  key: 'Q' | 'W' | 'E' | 'R'
  /** Data Dragon spell id (e.g. ShacoQ) */
  spellId: string
  /** Base damage per rank (index 0 = rank 1). Length typically 5 or 6. */
  baseDamageByRank: number[]
  /** Cooldown per rank (seconds). */
  cooldownByRank: number[]
  /** Cost per rank (mana/energy). */
  costByRank: number[]
  scaling: SpellScaling
}

/**
 * Result of spell damage calculation (no resistances/items/runes).
 */
export interface SpellDamageResult {
  spellKey: 'Q' | 'W' | 'E' | 'R'
  spellId: string
  spellLevel: number
  /** Base damage at this rank */
  base: number
  /** Ratios used (for display) */
  adRatio: number
  bonusAdRatio: number
  apRatio: number
  /** Total damage before mitigation */
  totalDamage: number
  /** Cooldown at this rank (seconds) */
  cooldown: number
  /** Cost at this rank */
  cost: number
}

/**
 * Full champion spell summary at a given level (for API/simulator output).
 */
export interface ChampionSpellSummary {
  champion: string
  championId: string
  level: number
  spells: Record<'Q' | 'W' | 'E' | 'R', SpellDamageResult>
}
