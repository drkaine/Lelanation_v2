/**
 * Gold efficiency calculation for builds.
 * Based on reference items (cheapest items that provide a given stat).
 */

const GOLD_VALUE_PER_STAT: Record<string, number> = {
  attackDamage: 35,
  abilityHaste: 50,
  abilityPower: 20,
  armor: 20,
  magicResist: 20,
  health: 2.666667,
  mana: 1,
  healthRegen: 3,
  manaRegen: 4,
  critChance: 40,
  attackSpeed: 25,
  movementSpeed: 12,
};

export function calculateGoldValue(stats: {
  health?: number;
  mana?: number;
  attackDamage?: number;
  abilityPower?: number;
  armor?: number;
  magicResist?: number;
  attackSpeed?: number;
  critChance?: number;
  healthRegen?: number;
  manaRegen?: number;
  movementSpeed?: number;
  abilityHaste?: number;
}): number {
  let total = 0;
  if (stats.health) total += stats.health * GOLD_VALUE_PER_STAT.health;
  if (stats.mana) total += stats.mana * GOLD_VALUE_PER_STAT.mana;
  if (stats.attackDamage)
    total += stats.attackDamage * GOLD_VALUE_PER_STAT.attackDamage;
  if (stats.abilityPower)
    total += stats.abilityPower * GOLD_VALUE_PER_STAT.abilityPower;
  if (stats.armor) total += stats.armor * GOLD_VALUE_PER_STAT.armor;
  if (stats.magicResist)
    total += stats.magicResist * GOLD_VALUE_PER_STAT.magicResist;
  if (stats.attackSpeed)
    total += stats.attackSpeed * 100 * GOLD_VALUE_PER_STAT.attackSpeed;
  if (stats.critChance)
    total += stats.critChance * 100 * GOLD_VALUE_PER_STAT.critChance;
  if (stats.healthRegen)
    total += stats.healthRegen * GOLD_VALUE_PER_STAT.healthRegen;
  if (stats.manaRegen)
    total += stats.manaRegen * GOLD_VALUE_PER_STAT.manaRegen;
  if (stats.movementSpeed)
    total += stats.movementSpeed * GOLD_VALUE_PER_STAT.movementSpeed;
  if (stats.abilityHaste)
    total += stats.abilityHaste * GOLD_VALUE_PER_STAT.abilityHaste;
  return Math.round(total);
}

export function calculateGoldEfficiency(
  goldValue: number,
  itemPrice: number
): number {
  if (itemPrice === 0) return 0;
  return (goldValue / itemPrice) * 100;
}

type ItemGoldInput = {
  stats?: {
    FlatHPPoolMod?: number;
    FlatMPPoolMod?: number;
    FlatPhysicalDamageMod?: number;
    FlatMagicDamageMod?: number;
    FlatArmorMod?: number;
    FlatSpellBlockMod?: number;
    PercentAttackSpeedMod?: number;
    FlatCritChanceMod?: number;
    FlatHPRegenMod?: number;
    FlatMPRegenMod?: number;
    FlatMovementSpeedMod?: number;
    rFlatCooldownModPerLevel?: number;
    [key: string]: number | undefined;
  };
  gold?: { total: number; base: number; sell: number; purchasable: boolean };
};

export function calculateItemGoldEfficiency(item: ItemGoldInput): number | null {
  if (!item.gold?.total || item.gold.total === 0) return null;
  if (!item.stats) return 0;
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
    abilityHaste:
      (item.stats as Record<string, number>).rFlatCooldownModPerLevel || 0,
  });
  return calculateGoldEfficiency(goldValue, item.gold.total);
}

export function calculateBuildGoldEfficiency(
  items: ItemGoldInput[]
): {
  totalGoldValue: number;
  totalGoldCost: number;
  goldEfficiency: number;
} {
  let totalGoldValue = 0;
  let totalGoldCost = 0;

  for (const item of items) {
    if (!item.gold?.total) continue;
    totalGoldCost += item.gold.total;
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
        abilityHaste:
          (item.stats as Record<string, number>).rFlatCooldownModPerLevel || 0,
      });
      totalGoldValue += itemGoldValue;
    }
  }

  const goldEfficiency =
    totalGoldCost > 0 ? (totalGoldValue / totalGoldCost) * 100 : 0;
  return {
    totalGoldValue,
    totalGoldCost,
    goldEfficiency,
  };
}
