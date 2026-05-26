export interface TheorycraftBuildStats {
  level: number
  totalAD: number
  bonusAD: number
  AP: number
  totalHP: number
  bonusHP: number
  armor: number
  magicResist: number
  maxMana: number
  critChance: number
  critDamage: number
  /** Fractional CDR from ability haste (0–1), items + shards. */
  cooldownReduction?: number
}

export interface TheorycraftSpellRatio {
  stat: keyof TheorycraftBuildStats | string
  coefficient: number[] | number
  type: 'physical' | 'magic' | 'true'
}

export interface TheorycraftDamageModifier {
  type: string
  value?: number
}

export interface TheorycraftDamageFormula {
  label: string
  baseValues: number[]
  ratios: TheorycraftSpellRatio[]
  modifiers?: TheorycraftDamageModifier[]
  expression?: string
}

export interface TheorycraftSpellData {
  id: string
  slot: 'Q' | 'W' | 'E' | 'R'
  name: string
  maxRank: number
  damageFormulas: TheorycraftDamageFormula[]
}

export interface TheorycraftStackStatBonus {
  stat: 'abilityPower' | 'attackDamage' | 'health' | 'armor' | 'magicResist' | 'attackSpeed'
  perStackKey: string
  isPercent?: boolean
}

export interface TheorycraftStackTooltipVar {
  key: string
  perStackKey: string
}

export interface TheorycraftStackDamageBonus {
  targetKey: string
  perStackKey: string
}

export interface TheorycraftStackFormulaVar {
  key: string
  formula: 'areaToRadiusPercent'
  areaPerStack: number
  baseRadius: number
}

export interface TheorycraftStackDefinition {
  id: string
  scope: 'passive' | 'spell'
  spellSlot?: string
  label: string
  maxStacks?: number
  statBonuses: TheorycraftStackStatBonus[]
  tooltipVars: TheorycraftStackTooltipVar[]
  damageBonuses?: TheorycraftStackDamageBonus[]
  formulaVars?: TheorycraftStackFormulaVar[]
  /** Champion ID for hardcoded custom tooltip var computation (e.g. Bard). */
  customVarsChampionId?: string
}
