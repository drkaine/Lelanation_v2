/**
 * Gold efficiency calculation utilities.
 * Based on reference items (cheapest items that provide a given stat).
 */

/**
 * Gold value per stat point for each stat type.
 * Based on the cheapest basic item that provides only that stat.
 */
const GOLD_VALUE_PER_STAT: Record<string, number> = {
  attackDamage: 35, // Long Sword: 350g for 10 AD
  abilityHaste: 50, // Glowing Mote: 250g for 5 AH
  abilityPower: 20, // Amplifying Tome: 400g for 20 AP
  armor: 20, // Cloth Armor: 300g for 15 Armor
  magicResist: 20, // Null-Magic Mantle: 400g for 20 MR
  health: 2.666667, // Ruby Crystal: 400g for 150 HP
  mana: 1, // Sapphire Crystal: 300g for 300 MP
  healthRegen: 3, // Rejuvenation Bead: 300g for 100% HP5
  manaRegen: 4, // Faerie Charm: 200g for 50% MP5
  critChance: 40, // Cloak of Agility: 600g for 15% Crit
  attackSpeed: 25, // Dagger: 250g for 10% AS
  movementSpeed: 12, // Boots: 300g for 25 MS
}

/**
 * Calculate the theoretical gold value of stats.
 * @param stats Object containing stat values
 * @returns Total gold value of the stats
 */
export function calculateGoldValue(stats: {
  health?: number
  mana?: number
  attackDamage?: number
  abilityPower?: number
  armor?: number
  magicResist?: number
  attackSpeed?: number // As percentage (0.1 = 10%)
  critChance?: number // As percentage (0.15 = 15%)
  healthRegen?: number
  manaRegen?: number
  movementSpeed?: number
  abilityHaste?: number
}): number {
  let total = 0

  if (stats.health) {
    total += stats.health * GOLD_VALUE_PER_STAT.health
  }
  if (stats.mana) {
    total += stats.mana * GOLD_VALUE_PER_STAT.mana
  }
  if (stats.attackDamage) {
    total += stats.attackDamage * GOLD_VALUE_PER_STAT.attackDamage
  }
  if (stats.abilityPower) {
    total += stats.abilityPower * GOLD_VALUE_PER_STAT.abilityPower
  }
  if (stats.armor) {
    total += stats.armor * GOLD_VALUE_PER_STAT.armor
  }
  if (stats.magicResist) {
    total += stats.magicResist * GOLD_VALUE_PER_STAT.magicResist
  }
  if (stats.attackSpeed) {
    // Convert to percentage (0.1 -> 10)
    total += stats.attackSpeed * 100 * GOLD_VALUE_PER_STAT.attackSpeed
  }
  if (stats.critChance) {
    // Convert to percentage (0.15 -> 15)
    total += stats.critChance * 100 * GOLD_VALUE_PER_STAT.critChance
  }
  if (stats.healthRegen) {
    total += stats.healthRegen * GOLD_VALUE_PER_STAT.healthRegen
  }
  if (stats.manaRegen) {
    total += stats.manaRegen * GOLD_VALUE_PER_STAT.manaRegen
  }
  if (stats.movementSpeed) {
    total += stats.movementSpeed * GOLD_VALUE_PER_STAT.movementSpeed
  }
  if (stats.abilityHaste) {
    total += stats.abilityHaste * GOLD_VALUE_PER_STAT.abilityHaste
  }

  return Math.round(total)
}

/**
 * Calculate gold efficiency percentage for an item.
 * @param goldValue Theoretical gold value of the item's stats
 * @param itemPrice Actual in-game price of the item
 * @returns Gold efficiency as a percentage (e.g., 120.5 for 120.5%)
 */
export function calculateGoldEfficiency(goldValue: number, itemPrice: number): number {
  if (itemPrice === 0) return 0
  return (goldValue / itemPrice) * 100
}

/**
 * Calculate gold efficiency for a single item.
 * @param item Item object with stats and gold information
 * @returns Gold efficiency percentage, or null if item has no price
 */
export function calculateItemGoldEfficiency(item: {
  stats?: {
    FlatHPPoolMod?: number
    FlatMPPoolMod?: number
    FlatPhysicalDamageMod?: number
    FlatMagicDamageMod?: number
    FlatArmorMod?: number
    FlatSpellBlockMod?: number
    PercentAttackSpeedMod?: number
    FlatCritChanceMod?: number
    FlatHPRegenMod?: number
    FlatMPRegenMod?: number
    FlatMovementSpeedMod?: number
    rFlatCooldownModPerLevel?: number
    [key: string]: number | undefined
  }
  gold?: {
    total: number
    base: number
    sell: number
    purchasable: boolean
  }
}): number | null {
  if (!item.gold || !item.gold.total || item.gold.total === 0) {
    return null
  }

  if (!item.stats) {
    return 0
  }

  const goldValue = calculateGoldValue({
    health: item.stats.FlatHPPoolMod || 0,
    mana: item.stats.FlatMPPoolMod || 0,
    attackDamage: item.stats.FlatPhysicalDamageMod || 0,
    abilityPower: item.stats.FlatMagicDamageMod || 0,
    armor: item.stats.FlatArmorMod || 0,
    magicResist: item.stats.FlatSpellBlockMod || 0,
    attackSpeed: (item.stats.PercentAttackSpeedMod || 0) / 100,
    critChance: (item.stats.FlatCritChanceMod || 0) / 100,
    healthRegen: item.stats.FlatHPRegenMod || 0,
    manaRegen: item.stats.FlatMPRegenMod || 0,
    movementSpeed: item.stats.FlatMovementSpeedMod || 0,
    abilityHaste: (item.stats as any).rFlatCooldownModPerLevel || 0,
  })

  return calculateGoldEfficiency(goldValue, item.gold.total)
}

/**
 * Calculate total gold efficiency for a build (all items combined).
 * @param items Array of items in the build
 * @returns Object with totalGoldValue, totalGoldCost, and goldEfficiency
 */
export function calculateBuildGoldEfficiency(
  items: Array<{
    stats?: {
      FlatHPPoolMod?: number
      FlatMPPoolMod?: number
      FlatPhysicalDamageMod?: number
      FlatMagicDamageMod?: number
      FlatArmorMod?: number
      FlatSpellBlockMod?: number
      PercentAttackSpeedMod?: number
      FlatCritChanceMod?: number
      FlatHPRegenMod?: number
      FlatMPRegenMod?: number
      FlatMovementSpeedMod?: number
      rFlatCooldownModPerLevel?: number
      [key: string]: number | undefined
    }
    gold?: {
      total: number
      base: number
      sell: number
      purchasable: boolean
    }
  }>
): {
  totalGoldValue: number
  totalGoldCost: number
  goldEfficiency: number
} {
  let totalGoldValue = 0
  let totalGoldCost = 0

  for (const item of items) {
    if (!item.gold || !item.gold.total) continue

    totalGoldCost += item.gold.total

    if (item.stats) {
      const itemGoldValue = calculateGoldValue({
        health: item.stats.FlatHPPoolMod || 0,
        mana: item.stats.FlatMPPoolMod || 0,
        attackDamage: item.stats.FlatPhysicalDamageMod || 0,
        abilityPower: item.stats.FlatMagicDamageMod || 0,
        armor: item.stats.FlatArmorMod || 0,
        magicResist: item.stats.FlatSpellBlockMod || 0,
        attackSpeed: (item.stats.PercentAttackSpeedMod || 0) / 100,
        critChance: (item.stats.FlatCritChanceMod || 0) / 100,
        healthRegen: item.stats.FlatHPRegenMod || 0,
        manaRegen: item.stats.FlatMPRegenMod || 0,
        movementSpeed: item.stats.FlatMovementSpeedMod || 0,
        abilityHaste: (item.stats as any).rFlatCooldownModPerLevel || 0,
      })
      totalGoldValue += itemGoldValue
    }
  }

  const goldEfficiency = totalGoldCost > 0 ? (totalGoldValue / totalGoldCost) * 100 : 0

  return {
    totalGoldValue,
    totalGoldCost,
    goldEfficiency,
  }
}
