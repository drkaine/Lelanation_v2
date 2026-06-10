/**
 * Build-related types — framework-agnostic, shared by frontend + companion-app.
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
  /** Heal & shield power (items); often only in description, enriched by backend. */
  PercentHealShieldPower?: number
  rFlatCooldownModPerLevel?: number
  /** Passive gold per 10 s (support items); may be injected from `effect` on sync. */
  GoldPer10?: number
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
  /** Ornn Masterwork upgrade - only shown in theorycraft, not in build item list */
  isMasterwork?: boolean
  baseItemId?: string
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
  slot1: number
  slot2: number
  slot3: number
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
  firstThreeUps: ['Q' | 'W' | 'E' | 'R', 'Q' | 'W' | 'E' | 'R', 'Q' | 'W' | 'E' | 'R']
  skillUpOrder: ['Q' | 'W' | 'E' | 'R', 'Q' | 'W' | 'E' | 'R', 'Q' | 'W' | 'E' | 'R']
}

export type Role = 'top' | 'jungle' | 'mid' | 'adc' | 'support'
export type BuildTag = 'pro' | 'otp' | 'exotique' | 'troll'

/** Kayn transformation form: 0 = base, 1 = Darkin, 2 = Assassin. */
export type KaynForm = 0 | 1 | 2

/** Build flagged because champion/items/runes appear in patch notes. */
export interface PatchStaleInfo {
  patchVersion: string
  flaggedAt: string
  categories: Array<'champion' | 'item' | 'rune'>
}

/** A build variant (sub-build). Same content as Build but champion is always inherited from the parent build. */
export interface SubBuild {
  title: string
  description?: string
  champion: Champion | null
  items: Item[]
  runes: RuneSelection | null
  shards: ShardSelection | null
  summonerSpells: [SummonerSpell | null, SummonerSpell | null]
  skillOrder: SkillOrder | null
  roles: Role[]
  tags?: BuildTag[]
  gameVersion: string
  /** Kayn only: portrait + tooltip form for this variant. */
  kaynForm?: KaynForm
}

/** Lightweight (serialized) version of SubBuild for storage. */
export interface StoredSubBuild {
  title: string
  description?: string
  champion: ChampionRef | null
  items: ItemRef[]
  runes: RuneSelection | null
  shards: ShardSelection | null
  summonerSpells: [SummonerSpellRef | null, SummonerSpellRef | null]
  skillOrder: SkillOrder | null
  roles: Role[]
  tags?: BuildTag[]
  gameVersion: string
  kaynForm?: KaynForm
}

export interface Build {
  id: string
  name: string
  author?: string
  description?: string
  visibility?: 'public' | 'private'
  champion: Champion | null
  items: Item[]
  runes: RuneSelection | null
  shards: ShardSelection | null
  summonerSpells: [SummonerSpell | null, SummonerSpell | null]
  skillOrder: SkillOrder | null
  roles: Role[]
  tags?: BuildTag[]
  upvote: number
  downvote: number
  gameVersion: string
  createdAt: string
  updatedAt: string
  subBuilds?: SubBuild[]
  descriptionMode?: 'single' | 'multiple'
  patchStale?: PatchStaleInfo | null
  /** Kayn only: portrait + tooltip form for the main variant. */
  kaynForm?: KaynForm
}

export interface ChampionRef {
  id: string
  name: string
  image: { full: string }
}

export interface ItemRef {
  id: string
  image?: { full: string }
}

export interface SummonerSpellRef {
  id: string
  key?: string
  image?: { full: string }
}

export interface StoredBuild {
  id: string
  name: string
  author?: string
  description?: string
  visibility?: 'public' | 'private'
  champion: ChampionRef | null
  items: ItemRef[]
  runes: RuneSelection | null
  shards: ShardSelection | null
  summonerSpells: [SummonerSpellRef | null, SummonerSpellRef | null]
  skillOrder: SkillOrder | null
  roles: Role[]
  tags?: BuildTag[]
  upvote: number
  downvote: number
  gameVersion: string
  createdAt: string
  updatedAt: string
  subBuilds?: StoredSubBuild[]
  descriptionMode?: 'single' | 'multiple'
  patchStale?: PatchStaleInfo | null
  kaynForm?: KaynForm
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
  /** Flat armor penetration from items (summed). */
  flatArmorPenetration: number
  magicPenetration: number
  /** Flat magic penetration from items (summed). */
  flatMagicPenetration: number
  tenacity: number
  lethality: number
  percentLethality: number
  omnivamp: number
  shield: number
  /** Heal & shield power from items (0–1, same scale as life steal). */
  healShieldPower: number
  attackRange: number
  /** Passive gold per 10 s from items (e.g. support quest line). */
  goldPer10: number
  /** Flat damage reduction percent from spell buffs (0–1). Multiplicative with armor/MR mitigation. */
  damageReduction?: number
}
