/**
 * Build-related types
 */

export interface ChampionStats {
  hp: number
  hpperlevel: number
  mp: number
  mpperlevel: number
  movespeed: number
  armor: number
  armorperlevel: number
  spellblock: number
  spellblockperlevel: number
  attackrange: number
  hpregen: number
  hpregenperlevel: number
  mpregen: number
  mpregenperlevel: number
  crit: number
  critperlevel: number
  attackdamage: number
  attackdamageperlevel: number
  attackspeedperlevel: number
  attackspeed: number
}

export interface Spell {
  id: string
  name: string
  description: string
  tooltip: string
  leveltip?: {
    label: string[]
    effect: string[]
  }
  maxrank: number
  cooldown: number[]
  cooldownBurn: string
  cost: number[]
  costBurn: string
  effect: Array<number[] | null>
  effectBurn: Array<string | null>
  vars: unknown[]
  costType: string
  maxammo: string
  range: number[]
  rangeBurn: string
  image: {
    full: string
    sprite: string
    group: string
    x: number
    y: number
    w: number
    h: number
  }
  resource: string
}

export interface Passive {
  name: string
  description: string
  image: {
    full: string
    sprite: string
    group: string
    x: number
    y: number
    w: number
    h: number
  }
}

export interface Champion {
  id: string
  key: string
  name: string
  title: string
  image: {
    full: string
    sprite: string
    group: string
    x: number
    y: number
    w: number
    h: number
  }
  stats: ChampionStats
  spells: Spell[]
  passive: Passive
  tags: string[]
}

export interface ItemStats {
  FlatHPPoolMod?: number
  rFlatHPModPerLevel?: number
  FlatMPPoolMod?: number
  rFlatMPModPerLevel?: number
  PercentHPPoolMod?: number
  PercentMPPoolMod?: number
  FlatHPRegenMod?: number
  rFlatHPRegenModPerLevel?: number
  PercentHPRegenMod?: number
  FlatMPRegenMod?: number
  rFlatMPRegenModPerLevel?: number
  PercentMPRegenMod?: number
  FlatArmorMod?: number
  rFlatArmorModPerLevel?: number
  PercentArmorMod?: number
  rFlatArmorPenetrationMod?: number
  rPercentArmorPenetrationMod?: number
  rFlatArmorPenetrationModPerLevel?: number
  rPercentArmorPenetrationModPerLevel?: number
  FlatPhysicalDamageMod?: number
  rFlatPhysicalDamageModPerLevel?: number
  PercentPhysicalDamageMod?: number
  FlatMagicDamageMod?: number
  rFlatMagicDamageModPerLevel?: number
  PercentMagicDamageMod?: number
  FlatMovementSpeedMod?: number
  PercentMovementSpeedMod?: number
  rFlatMovementSpeedModPerLevel?: number
  PercentAttackSpeedMod?: number
  rPercentAttackSpeedModPerLevel?: number
  rFlatAttackSpeedModPerLevel?: number
  FlatCritChanceMod?: number
  rFlatCritChanceModPerLevel?: number
  PercentCritChanceMod?: number
  FlatCritDamageMod?: number
  rFlatCritDamageModPerLevel?: number
  PercentCritDamageMod?: number
  FlatBlockMod?: number
  PercentBlockMod?: number
  FlatSpellBlockMod?: number
  rFlatSpellBlockModPerLevel?: number
  PercentSpellBlockMod?: number
  rFlatSpellPenetrationMod?: number
  rPercentSpellPenetrationMod?: number
  rFlatSpellPenetrationModPerLevel?: number
  rPercentSpellPenetrationModPerLevel?: number
  rFlatEnergyPoolMod?: number
  rFlatEnergyModPerLevel?: number
  rFlatEnergyRegenMod?: number
  rFlatEnergyRegenModPerLevel?: number
  PercentLifeStealMod?: number
  PercentSpellVampMod?: number
  [key: string]: number | undefined
}

export interface Item {
  id: string
  name: string
  description: string
  colloq: string
  plaintext: string
  image: {
    full: string
    sprite: string
    group: string
    x: number
    y: number
    w: number
    h: number
  }
  gold: {
    base: number
    total: number
    sell: number
    purchasable: boolean
  }
  tags: string[]
  stats?: ItemStats
  depth: number
  into?: string[]
  from?: string[]
  maps?: Record<string, boolean>
}

export interface RunePath {
  id: number
  key: string
  icon: string
  name: string
  slots: Array<{
    runes: Array<{
      id: number
      key: string
      icon: string
      name: string
      shortDesc: string
      longDesc: string
    }>
  }>
}

export interface RuneSelection {
  primary: {
    pathId: number
    keystone: number
    slot1: number
    slot2: number
    slot3: number
  }
  secondary: {
    pathId: number
    slot1: number
    slot2: number
  }
}

export interface RuneShard {
  id: number
  name: string
  icon: string
  shortDesc: string
  longDesc: string
}

export interface ShardSelection {
  slot1: number // Adaptive Force, Attack Speed, Ability Haste
  slot2: number // Adaptive Force, Armor, Magic Resist
  slot3: number // Health, Armor, Magic Resist
}

export interface SummonerSpell {
  id: string
  name: string
  description: string
  tooltip: string
  maxrank: number
  cooldown: number[]
  cooldownBurn: string
  cost: number[]
  costBurn: string
  datavalues: unknown
  effect: Array<number[] | null>
  effectBurn: Array<string | null>
  vars: unknown[]
  key: string
  summonerLevel: number
  modes: string[]
  costType: string
  maxammo: string
  range: number[]
  rangeBurn: string
  image: {
    full: string
    sprite: string
    group: string
    x: number
    y: number
    w: number
    h: number
  }
  resource: string
}

export interface SkillOrder {
  level1: 'Q' | 'W' | 'E' | 'R'
  level2: 'Q' | 'W' | 'E' | 'R'
  level3: 'Q' | 'W' | 'E' | 'R'
  level4: 'Q' | 'W' | 'E' | 'R'
  level5: 'Q' | 'W' | 'E' | 'R'
  level6: 'Q' | 'W' | 'E' | 'R'
  level7: 'Q' | 'W' | 'E' | 'R'
  level8: 'Q' | 'W' | 'E' | 'R'
  level9: 'Q' | 'W' | 'E' | 'R'
  level10: 'Q' | 'W' | 'E' | 'R'
  level11: 'Q' | 'W' | 'E' | 'R'
  level12: 'Q' | 'W' | 'E' | 'R'
  level13: 'Q' | 'W' | 'E' | 'R'
  level14: 'Q' | 'W' | 'E' | 'R'
  level15: 'Q' | 'W' | 'E' | 'R'
  level16: 'Q' | 'W' | 'E' | 'R'
  level17: 'Q' | 'W' | 'E' | 'R'
  level18: 'Q' | 'W' | 'E' | 'R'
}

export interface Build {
  id: string
  name: string
  champion: Champion | null
  items: Item[]
  runes: RuneSelection | null
  shards: ShardSelection | null
  summonerSpells: [SummonerSpell | null, SummonerSpell | null]
  skillOrder: SkillOrder | null
  gameVersion: string
  createdAt: string
  updatedAt: string
}

export interface CalculatedStats {
  health: number
  mana: number
  attackDamage: number
  abilityPower: number
  armor: number
  magicResist: number
  attackSpeed: number
  critChance: number
  critDamage: number
  lifeSteal: number
  spellVamp: number
  cooldownReduction: number
  movementSpeed: number
  healthRegen: number
  manaRegen: number
  armorPenetration: number
  magicPenetration: number
  tenacity: number
}
