import type {
  Champion,
  ChampionStats,
  Item,
  ItemStats,
  RuneSelection,
  ShardSelection,
  CalculatedStats,
} from '~/types/build'

/**
 * Calculate final statistics for a build
 * Takes into account: champion base stats, items, runes, shards
 */
export function calculateStats(
  champion: Champion | null,
  items: Item[],
  runes: RuneSelection | null,
  shards: ShardSelection | null,
  level: number = 18
): CalculatedStats | null {
  if (!champion) {
    return null
  }

  // Start with champion base stats at specified level
  const baseStats = calculateChampionStatsAtLevel(champion.stats, level)

  // Add item stats
  const itemStats = calculateItemStats(items)

  // Add rune stats (if any)
  const runeStats = calculateRuneStats(runes)

  // Add shard stats
  const shardStats = calculateShardStats(shards)

  // Combine all stats (including shards)
  const finalStats: CalculatedStats = {
    health: baseStats.hp + (itemStats.health || 0) + (shardStats.health || 0),
    mana: baseStats.mp + (itemStats.mana || 0),
    attackDamage:
      baseStats.attackdamage +
      (itemStats.attackDamage || 0) +
      (runeStats.attackDamage || 0) +
      (shardStats.attackDamage || 0),
    abilityPower:
      (itemStats.abilityPower || 0) +
      (runeStats.abilityPower || 0) +
      (shardStats.abilityPower || 0),
    armor: baseStats.armor + (itemStats.armor || 0) + (shardStats.armor || 0),
    magicResist:
      baseStats.spellblock + (itemStats.magicResist || 0) + (shardStats.magicResist || 0),
    attackSpeed: calculateAttackSpeed(
      baseStats.attackspeed,
      (itemStats.attackSpeed || 0) + (shardStats.attackSpeed || 0)
    ),
    critChance: (itemStats.critChance || 0) / 100, // Convert to decimal
    critDamage: 1.75 + (itemStats.critDamage || 0) / 100, // Base 175% + items
    lifeSteal: (itemStats.lifeSteal || 0) / 100,
    spellVamp: (itemStats.spellVamp || 0) / 100,
    cooldownReduction: calculateCooldownReduction(
      (itemStats.cooldownReduction || 0) + (shardStats.abilityHaste || 0)
    ),
    movementSpeed: calculateMovementSpeed(
      baseStats.movespeed,
      itemStats.movementSpeed || 0,
      itemStats.percentMovementSpeed || 0
    ),
    healthRegen: baseStats.hpregen + (itemStats.healthRegen || 0),
    manaRegen: baseStats.mpregen + (itemStats.manaRegen || 0),
    armorPenetration: (itemStats.armorPenetration || 0) / 100,
    magicPenetration: (itemStats.magicPenetration || 0) / 100,
    tenacity: (itemStats.tenacity || 0) / 100,
    lethality: itemStats.lethality || 0,
    omnivamp: (itemStats.omnivamp || 0) / 100,
    shield: itemStats.shield || 0,
    attackRange: baseStats.attackrange + (itemStats.attackRange || 0),
  }

  return finalStats
}

/**
 * Calculate champion stats at a specific level
 */
function calculateChampionStatsAtLevel(
  baseStats: ChampionStats,
  level: number
): ChampionStats & { attackdamage: number; attackspeed: number } {
  const levelMultiplier = level - 1

  return {
    ...baseStats,
    hp: baseStats.hp + baseStats.hpperlevel * levelMultiplier,
    mp: baseStats.mp + baseStats.mpperlevel * levelMultiplier,
    armor: baseStats.armor + baseStats.armorperlevel * levelMultiplier,
    spellblock: baseStats.spellblock + baseStats.spellblockperlevel * levelMultiplier,
    hpregen: baseStats.hpregen + baseStats.hpregenperlevel * levelMultiplier,
    mpregen: baseStats.mpregen + baseStats.mpregenperlevel * levelMultiplier,
    crit: baseStats.crit + baseStats.critperlevel * levelMultiplier,
    attackdamage: baseStats.attackdamage + baseStats.attackdamageperlevel * levelMultiplier,
    attackspeed:
      baseStats.attackspeed * (1 + (baseStats.attackspeedperlevel / 100) * levelMultiplier),
  }
}

/**
 * Sum all item stats
 */
function calculateItemStats(items: Item[]): ItemStats & {
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
  percentMovementSpeed: number
  healthRegen: number
  manaRegen: number
  armorPenetration: number
  magicPenetration: number
  tenacity: number
  lethality: number
  omnivamp: number
  shield: number
  attackRange: number
} {
  const totals: Record<string, number> = {
    health: 0,
    mana: 0,
    attackDamage: 0,
    abilityPower: 0,
    armor: 0,
    magicResist: 0,
    attackSpeed: 0,
    critChance: 0,
    critDamage: 0,
    lifeSteal: 0,
    spellVamp: 0,
    cooldownReduction: 0,
    movementSpeed: 0,
    percentMovementSpeed: 0,
    healthRegen: 0,
    manaRegen: 0,
    armorPenetration: 0,
    magicPenetration: 0,
    tenacity: 0,
    lethality: 0,
    omnivamp: 0,
    shield: 0,
    attackRange: 0,
  }

  for (const item of items) {
    if (!item.stats) continue

    // Map Data Dragon stat names to our stat names
    totals.health += item.stats.FlatHPPoolMod || 0
    totals.mana += item.stats.FlatMPPoolMod || 0
    totals.attackDamage += item.stats.FlatPhysicalDamageMod || 0
    totals.abilityPower += item.stats.FlatMagicDamageMod || 0
    totals.armor += item.stats.FlatArmorMod || 0
    totals.magicResist += item.stats.FlatSpellBlockMod || 0
    totals.attackSpeed += (item.stats.PercentAttackSpeedMod || 0) / 100
    totals.critChance += item.stats.FlatCritChanceMod || 0
    totals.critDamage += item.stats.FlatCritDamageMod || 0
    totals.lifeSteal += item.stats.PercentLifeStealMod || 0
    totals.spellVamp += item.stats.PercentSpellVampMod || 0
    totals.cooldownReduction += item.stats.rFlatCooldownModPerLevel || 0 // Simplified
    totals.movementSpeed += item.stats.FlatMovementSpeedMod || 0
    totals.percentMovementSpeed += item.stats.PercentMovementSpeedMod || 0
    totals.healthRegen += item.stats.FlatHPRegenMod || 0
    totals.manaRegen += item.stats.FlatMPRegenMod || 0
    totals.armorPenetration += item.stats.rPercentArmorPenetrationMod || 0
    totals.magicPenetration += item.stats.rPercentSpellPenetrationMod || 0
    // Lethality (FlatLethality)
    totals.lethality += (item.stats as any).FlatLethality || 0
    // Omnivamp (FlatOmnivamp + PercentOmnivamp)
    totals.omnivamp +=
      ((item.stats as any).FlatOmnivamp || 0) + ((item.stats as any).PercentOmnivamp || 0)
    // Shield (FlatShield + PercentShield - simplified as flat value)
    totals.shield +=
      ((item.stats as any).FlatShield || 0) + ((item.stats as any).PercentShield || 0)
    // Attack Range (FlatAttackRangeMod)
    totals.attackRange += (item.stats as any).FlatAttackRangeMod || 0
    // Tenacity is usually from runes, but can be from items
  }

  return totals as typeof totals & ItemStats
}

/**
 * Calculate rune stats (simplified - runes provide various bonuses)
 */
function calculateRuneStats(runes: RuneSelection | null): {
  attackDamage?: number
  abilityPower?: number
  [key: string]: number | undefined
} {
  if (!runes) {
    return {}
  }

  // TODO: Implement actual rune stat calculations
  // This is a placeholder - actual runes provide complex bonuses
  // that need to be calculated based on rune IDs and their effects
  return {}
}

/**
 * Calculate shard stats
 */
function calculateShardStats(shards: ShardSelection | null): {
  armor?: number
  magicResist?: number
  health?: number
  attackDamage?: number
  abilityPower?: number
  attackSpeed?: number
  abilityHaste?: number
} {
  if (!shards) {
    return {}
  }

  const stats: {
    armor?: number
    magicResist?: number
    health?: number
    attackDamage?: number
    abilityPower?: number
    attackSpeed?: number
    abilityHaste?: number
  } = {}

  // Slot 1: Adaptive Force (5008), Attack Speed (5005), Ability Haste (5007)
  if (shards.slot1 === 5008) {
    // Adaptive Force: +9 AD or +15 AP (simplified as AD)
    stats.attackDamage = 9
  } else if (shards.slot1 === 5005) {
    stats.attackSpeed = 0.1 // 10% attack speed
  } else if (shards.slot1 === 5007) {
    stats.abilityHaste = 8
  }

  // Slot 2: Adaptive Force (5008), Armor (5002), Magic Resist (5003)
  if (shards.slot2 === 5008) {
    stats.attackDamage = (stats.attackDamage || 0) + 9
  } else if (shards.slot2 === 5002) {
    stats.armor = 6
  } else if (shards.slot2 === 5003) {
    stats.magicResist = 8
  }

  // Slot 3: Health (5001), Armor (5002), Magic Resist (5003)
  if (shards.slot3 === 5001) {
    stats.health = 15
  } else if (shards.slot3 === 5002) {
    stats.armor = (stats.armor || 0) + 6
  } else if (shards.slot3 === 5003) {
    stats.magicResist = (stats.magicResist || 0) + 8
  }

  return stats
}

/**
 * Calculate final attack speed
 */
function calculateAttackSpeed(baseAttackSpeed: number, bonusAttackSpeed: number): number {
  return baseAttackSpeed * (1 + bonusAttackSpeed)
}

/**
 * Calculate cooldown reduction (ability haste conversion)
 */
function calculateCooldownReduction(abilityHaste: number): number {
  // Ability Haste formula: CDR = 1 - (1 / (1 + AH/100))
  if (abilityHaste === 0) return 0
  return 1 - 1 / (1 + abilityHaste / 100)
}

/**
 * Calculate final movement speed
 */
function calculateMovementSpeed(
  baseMovementSpeed: number,
  flatBonus: number,
  percentBonus: number
): number {
  return (baseMovementSpeed + flatBonus) * (1 + percentBonus / 100)
}
