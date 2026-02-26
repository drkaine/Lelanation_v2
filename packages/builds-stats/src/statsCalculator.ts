/**
 * Stats calculation for builds.
 * Shared by frontend and companion-app.
 */
import { isBootsItem, isStarterItem } from "@lelanation/builds-ui";
import type {
  Champion,
  ChampionStats,
  Item,
  RuneSelection,
  ShardSelection,
  CalculatedStats,
} from "@lelanation/shared-types";

export interface CalculateStatsOptions {
  /** Item ID -> stack count for stackable items (Mejai, Manamune, etc.) */
  itemStacks?: Record<string, number>;
  /** Stack type -> stack count for champion passives (Veigar Q, Sion passive, etc.) */
  passiveStacks?: Record<string, number>;
  /** Optional: compute bonus stats from item stacks. If not provided, no item stack bonuses. */
  getItemStackStats?: (itemId: string, stacks: number) => Record<string, number>;
  /** Optional: compute bonus stats from champion passive stacks. If not provided, no passive bonuses. */
  getPassiveStackStats?: (
    championId: string,
    stackType: string,
    stacks: number
  ) => Record<string, number>;
}

/**
 * Filter items for stats calculation: exclude starter items, keep only first boots if multiple.
 */
export function filterItemsForStats(items: Item[]): Item[] {
  const bootsItems = items.filter((i) => isBootsItem(i));
  const nonStarterNonBoots = items.filter(
    (i) => !isStarterItem(i) && !isBootsItem(i)
  );
  const bootsForStats: Item[] = bootsItems.length > 0 ? [bootsItems[0]!] : [];
  return [...nonStarterNonBoots, ...bootsForStats];
}

/**
 * Calculate final statistics for a build.
 * Takes into account: champion base stats, items, runes, shards, optional item/passive stacks.
 */
export function calculateStats(
  champion: Champion | null,
  items: Item[],
  runes: RuneSelection | null,
  shards: ShardSelection | null,
  level = 18,
  options?: CalculateStatsOptions
): CalculatedStats | null {
  if (!champion) return null;

  const baseStats = calculateChampionStatsAtLevel(champion.stats, level);
  const itemStats = calculateItemStats(items, options);
  const runeStats = calculateRuneStats(runes);
  const shardStats = calculateShardStats(shards, level);
  const passiveStackStats = calculatePassiveStackStats(champion.id, options);

  const finalStats: CalculatedStats = {
    health:
      baseStats.hp +
      (itemStats.health || 0) +
      (shardStats.health || 0) +
      (passiveStackStats.health || 0),
    mana: baseStats.mp + (itemStats.mana || 0),
    attackDamage:
      baseStats.attackdamage +
      (itemStats.attackDamage || 0) +
      (runeStats.attackDamage || 0) +
      (shardStats.attackDamage || 0) +
      (passiveStackStats.attackDamage || 0),
    abilityPower:
      (itemStats.abilityPower || 0) +
      (runeStats.abilityPower || 0) +
      (shardStats.abilityPower || 0) +
      (passiveStackStats.abilityPower || 0),
    armor:
      baseStats.armor +
      (itemStats.armor || 0) +
      (shardStats.armor || 0) +
      (passiveStackStats.armor || 0),
    magicResist:
      baseStats.spellblock +
      (itemStats.magicResist || 0) +
      (shardStats.magicResist || 0) +
      (passiveStackStats.magicResist || 0),
    attackSpeed: calculateAttackSpeed(
      baseStats.attackspeed,
      (itemStats.attackSpeed || 0) + (shardStats.attackSpeed || 0)
    ),
    critChance: (itemStats.critChance || 0) / 100,
    critDamage: 1.75 + (itemStats.critDamage || 0) / 100,
    lifeSteal: (itemStats.lifeSteal || 0) / 100,
    spellVamp: (itemStats.spellVamp || 0) / 100,
    cooldownReduction: calculateCooldownReduction(
      (itemStats.cooldownReduction || 0) + (shardStats.abilityHaste || 0)
    ),
    movementSpeed: calculateMovementSpeed(
      baseStats.movespeed,
      (itemStats.movementSpeed || 0) + (shardStats.movementSpeed || 0),
      (itemStats.percentMovementSpeed || 0) +
        (shardStats.percentMovementSpeed || 0)
    ),
    healthRegen: baseStats.hpregen + (itemStats.healthRegen || 0),
    manaRegen: baseStats.mpregen + (itemStats.manaRegen || 0),
    armorPenetration: (itemStats.armorPenetration || 0) / 100,
    magicPenetration: (itemStats.magicPenetration || 0) / 100,
    tenacity: (itemStats.tenacity || 0) / 100 + (shardStats.tenacity || 0),
    lethality: itemStats.lethality || 0,
    omnivamp: (itemStats.omnivamp || 0) / 100,
    shield: itemStats.shield || 0,
    attackRange:
      baseStats.attackrange +
      (itemStats.attackRange || 0) +
      (passiveStackStats.attackRange || 0),
  };

  return finalStats;
}

function calculatePassiveStackStats(
  championId: string,
  options?: CalculateStatsOptions
): Record<string, number> {
  if (!options?.passiveStacks || !options.getPassiveStackStats) return {};
  const result: Record<string, number> = {};
  for (const [stackType, stacks] of Object.entries(options.passiveStacks)) {
    const stats = options.getPassiveStackStats(championId, stackType, stacks);
    for (const [k, v] of Object.entries(stats)) {
      if (v != null) result[k] = (result[k] || 0) + v;
    }
  }
  return result;
}

function calculateChampionStatsAtLevel(
  baseStats: ChampionStats,
  level: number
): ChampionStats & { attackdamage: number; attackspeed: number } {
  const levelMultiplier = level - 1;
  return {
    ...baseStats,
    hp: baseStats.hp + baseStats.hpperlevel * levelMultiplier,
    mp: baseStats.mp + baseStats.mpperlevel * levelMultiplier,
    armor: baseStats.armor + baseStats.armorperlevel * levelMultiplier,
    spellblock:
      baseStats.spellblock +
      baseStats.spellblockperlevel * levelMultiplier,
    hpregen: baseStats.hpregen + baseStats.hpregenperlevel * levelMultiplier,
    mpregen: baseStats.mpregen + baseStats.mpregenperlevel * levelMultiplier,
    crit: baseStats.crit + baseStats.critperlevel * levelMultiplier,
    attackdamage:
      baseStats.attackdamage +
      baseStats.attackdamageperlevel * levelMultiplier,
    attackspeed:
      baseStats.attackspeed *
      (1 + (baseStats.attackspeedperlevel / 100) * levelMultiplier),
  };
}

type ItemStatsTotals = {
  health: number;
  mana: number;
  attackDamage: number;
  abilityPower: number;
  armor: number;
  magicResist: number;
  attackSpeed: number;
  critChance: number;
  critDamage: number;
  lifeSteal: number;
  spellVamp: number;
  cooldownReduction: number;
  movementSpeed: number;
  percentMovementSpeed: number;
  healthRegen: number;
  manaRegen: number;
  armorPenetration: number;
  magicPenetration: number;
  tenacity: number;
  lethality: number;
  omnivamp: number;
  shield: number;
  attackRange: number;
};

function calculateItemStats(
  items: Item[],
  options?: CalculateStatsOptions
): ItemStatsTotals {
  const totals: ItemStatsTotals = {
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
  };

  for (const item of items) {
    if (!item.stats) continue;
    const s = item.stats as Record<string, number | undefined>;
    totals.health += s.FlatHPPoolMod || 0;
    totals.mana += s.FlatMPPoolMod || 0;
    totals.attackDamage += s.FlatPhysicalDamageMod || 0;
    totals.abilityPower += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.magicResist += s.FlatSpellBlockMod || 0;
    totals.attackSpeed += (s.PercentAttackSpeedMod || 0) / 100;
    totals.critChance += s.FlatCritChanceMod || 0;
    totals.critDamage += s.FlatCritDamageMod || 0;
    totals.lifeSteal += s.PercentLifeStealMod || 0;
    totals.spellVamp += s.PercentSpellVampMod || 0;
    totals.cooldownReduction += s.rFlatCooldownModPerLevel || 0;
    totals.movementSpeed += s.FlatMovementSpeedMod || 0;
    totals.percentMovementSpeed += s.PercentMovementSpeedMod || 0;
    totals.healthRegen += s.FlatHPRegenMod || 0;
    totals.manaRegen += s.FlatMPRegenMod || 0;
    totals.armorPenetration += s.rPercentArmorPenetrationMod || 0;
    totals.magicPenetration += s.rPercentSpellPenetrationMod || 0;
    totals.lethality += (s as Record<string, number>).FlatLethality || 0;
    totals.omnivamp +=
      ((s as Record<string, number>).FlatOmnivamp || 0) +
      ((s as Record<string, number>).PercentOmnivamp || 0);
    totals.shield +=
      ((s as Record<string, number>).FlatShield || 0) +
      ((s as Record<string, number>).PercentShield || 0);
    totals.attackRange += (s as Record<string, number>).FlatAttackRangeMod || 0;

    if (
      options?.itemStacks &&
      options.itemStacks[item.id] != null &&
      options.getItemStackStats
    ) {
      const stackStats = options.getItemStackStats(
        item.id,
        options.itemStacks[item.id]!
      );
      totals.health += stackStats.health || 0;
      totals.armor += stackStats.armor || 0;
      totals.attackDamage += stackStats.attackDamage || 0;
      totals.abilityPower += stackStats.abilityPower || 0;
      totals.magicResist += stackStats.magicResist || 0;
    }
  }

  return totals;
}

function calculateRuneStats(
  _runes: RuneSelection | null
): { attackDamage?: number; abilityPower?: number } {
  return {};
}

function calculateShardStats(
  shards: ShardSelection | null,
  level: number
): Record<string, number> {
  if (!shards) return {};
  const stats: Record<string, number> = {};
  if (shards.slot1 === 5008) stats.attackDamage = 5.4;
  else if (shards.slot1 === 5005) stats.attackSpeed = 0.1;
  else if (shards.slot1 === 5007) stats.abilityHaste = 8;

  if (shards.slot2 === 5008)
    stats.attackDamage = (stats.attackDamage || 0) + 5.4;
  else if (shards.slot2 === 5006) stats.percentMovementSpeed = 2.5;
  else if (shards.slot2 === 5002)
    stats.health = Math.round(10 + (level - 1) * (190 / 17));

  if (shards.slot3 === 5001) stats.health = 65;
  else if (shards.slot3 === 5003) stats.tenacity = 0.15;
  else if (shards.slot3 === 5002)
    stats.health =
      (stats.health || 0) + Math.round(10 + (level - 1) * (190 / 17));

  return stats;
}

function calculateAttackSpeed(
  baseAttackSpeed: number,
  bonusAttackSpeed: number
): number {
  return baseAttackSpeed * (1 + bonusAttackSpeed);
}

function calculateCooldownReduction(abilityHaste: number): number {
  if (abilityHaste === 0) return 0;
  return 1 - 1 / (1 + abilityHaste / 100);
}

function calculateMovementSpeed(
  baseMovementSpeed: number,
  flatBonus: number,
  percentBonus: number
): number {
  return (baseMovementSpeed + flatBonus) * (1 + percentBonus / 100);
}
