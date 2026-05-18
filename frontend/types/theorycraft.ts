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
