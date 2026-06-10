/**
 * Gold efficiency calculation for builds.
 * Reference prices from https://wiki.leagueoflegends.com/en-us/Gold_efficiency
 */

/** Basic reference items (cheapest item providing only that stat). */
const GOLD_PER_STAT = {
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
} as const;

/** Secondary stats (derived from epic/legendary reference items). */
const GOLD_PER_SECONDARY_STAT = {
  armorPenetrationPercent: 41.666667,
  healShieldPower: 50,
  lethality: 30,
  lifeSteal: 53.55,
  magicPenetrationFlat: 46.666667,
  magicPenetrationPercent: 46.15,
  omnivamp: 41,
  onHitDamage: 21.666666,
  tenacity: 10.333334,
  percentMovementSpeed: 65.105,
} as const;

export type GoldValueStats = {
  health?: number;
  mana?: number;
  attackDamage?: number;
  abilityPower?: number;
  armor?: number;
  magicResist?: number;
  /** Attack speed as decimal (0.10 = 10%). */
  attackSpeed?: number;
  /** Crit chance as decimal (0.15 = 15%). */
  critChance?: number;
  healthRegen?: number;
  manaRegen?: number;
  movementSpeed?: number;
  abilityHaste?: number;
  armorPenetrationPercent?: number;
  healShieldPower?: number;
  lethality?: number;
  lifeSteal?: number;
  magicPenetrationFlat?: number;
  magicPenetrationPercent?: number;
  omnivamp?: number;
  onHitDamage?: number;
  tenacity?: number;
  percentMovementSpeed?: number;
};

type ItemStatsRecord = Record<string, number | undefined>;

function normalizePercentStat(value: number | undefined): number {
  const raw = value ?? 0;
  if (!Number.isFinite(raw)) return 0;
  return Math.abs(raw) <= 1 ? raw * 100 : raw;
}

function addStat(total: number, amount: number | undefined, goldPerPoint: number): number {
  if (!amount || !Number.isFinite(amount)) return total;
  return total + amount * goldPerPoint;
}

/** Map Data Dragon / enriched item stats to gold-value inputs. */
export function itemStatsToGoldValueStats(stats: ItemStatsRecord): GoldValueStats {
  const rec = stats as ItemStatsRecord & {
    FlatLethality?: number;
    FlatTenacity?: number;
    PercentTenacity?: number;
    PercentOmnivamp?: number;
    FlatOmnivamp?: number;
    PercentHealShieldPower?: number;
    FlatOnHitDamage?: number;
  };

  return {
    health: rec.FlatHPPoolMod || 0,
    mana: rec.FlatMPPoolMod || 0,
    attackDamage: rec.FlatPhysicalDamageMod || 0,
    abilityPower: rec.FlatMagicDamageMod || 0,
    armor: rec.FlatArmorMod || 0,
    magicResist: rec.FlatSpellBlockMod || 0,
    attackSpeed: normalizePercentStat(rec.PercentAttackSpeedMod) / 100,
    critChance:
      normalizePercentStat(rec.FlatCritChanceMod ?? rec.PercentCritChanceMod) / 100,
    healthRegen:
      normalizePercentStat(rec.PercentHPRegenMod) + (rec.FlatHPRegenMod || 0),
    manaRegen:
      normalizePercentStat(rec.PercentMPRegenMod) + (rec.FlatMPRegenMod || 0),
    movementSpeed: rec.FlatMovementSpeedMod || 0,
    abilityHaste: rec.rFlatCooldownModPerLevel || 0,
    armorPenetrationPercent: normalizePercentStat(rec.rPercentArmorPenetrationMod),
    healShieldPower: normalizePercentStat(rec.PercentHealShieldPower),
    lethality: rec.FlatLethality || 0,
    lifeSteal: normalizePercentStat(rec.PercentLifeStealMod),
    magicPenetrationFlat: rec.rFlatSpellPenetrationMod || 0,
    magicPenetrationPercent: normalizePercentStat(rec.rPercentSpellPenetrationMod),
    omnivamp: (rec.FlatOmnivamp || 0) + normalizePercentStat(rec.PercentOmnivamp),
    onHitDamage: rec.FlatOnHitDamage || 0,
    tenacity:
      normalizePercentStat(rec.PercentTenacity) + (rec.FlatTenacity || 0),
    percentMovementSpeed: normalizePercentStat(rec.PercentMovementSpeedMod),
  };
}

export function calculateGoldValue(stats: GoldValueStats): number {
  let total = 0;
  total = addStat(total, stats.health, GOLD_PER_STAT.health);
  total = addStat(total, stats.mana, GOLD_PER_STAT.mana);
  total = addStat(total, stats.attackDamage, GOLD_PER_STAT.attackDamage);
  total = addStat(total, stats.abilityPower, GOLD_PER_STAT.abilityPower);
  total = addStat(total, stats.armor, GOLD_PER_STAT.armor);
  total = addStat(total, stats.magicResist, GOLD_PER_STAT.magicResist);
  total = addStat(
    total,
    stats.attackSpeed != null ? stats.attackSpeed * 100 : 0,
    GOLD_PER_STAT.attackSpeed
  );
  total = addStat(
    total,
    stats.critChance != null ? stats.critChance * 100 : 0,
    GOLD_PER_STAT.critChance
  );
  total = addStat(total, stats.healthRegen, GOLD_PER_STAT.healthRegen);
  total = addStat(total, stats.manaRegen, GOLD_PER_STAT.manaRegen);
  total = addStat(total, stats.movementSpeed, GOLD_PER_STAT.movementSpeed);
  total = addStat(total, stats.abilityHaste, GOLD_PER_STAT.abilityHaste);
  total = addStat(
    total,
    stats.armorPenetrationPercent,
    GOLD_PER_SECONDARY_STAT.armorPenetrationPercent
  );
  total = addStat(total, stats.healShieldPower, GOLD_PER_SECONDARY_STAT.healShieldPower);
  total = addStat(total, stats.lethality, GOLD_PER_SECONDARY_STAT.lethality);
  total = addStat(total, stats.lifeSteal, GOLD_PER_SECONDARY_STAT.lifeSteal);
  total = addStat(
    total,
    stats.magicPenetrationFlat,
    GOLD_PER_SECONDARY_STAT.magicPenetrationFlat
  );
  total = addStat(
    total,
    stats.magicPenetrationPercent,
    GOLD_PER_SECONDARY_STAT.magicPenetrationPercent
  );
  total = addStat(total, stats.omnivamp, GOLD_PER_SECONDARY_STAT.omnivamp);
  total = addStat(total, stats.onHitDamage, GOLD_PER_SECONDARY_STAT.onHitDamage);
  total = addStat(total, stats.tenacity, GOLD_PER_SECONDARY_STAT.tenacity);
  total = addStat(
    total,
    stats.percentMovementSpeed,
    GOLD_PER_SECONDARY_STAT.percentMovementSpeed
  );
  return Math.round(total);
}

export function calculateItemGoldValue(
  stats: ItemStatsRecord | undefined
): number {
  if (!stats) return 0;
  return calculateGoldValue(itemStatsToGoldValueStats(stats));
}

export function calculateGoldEfficiency(
  goldValue: number,
  itemPrice: number
): number {
  if (itemPrice === 0) return 0;
  return (goldValue / itemPrice) * 100;
}

type ItemGoldInput = {
  stats?: ItemStatsRecord;
  gold?: { total: number; base: number; sell: number; purchasable: boolean };
};

export function calculateItemGoldEfficiency(item: ItemGoldInput): number | null {
  if (!item.gold?.total || item.gold.total === 0) return null;
  if (!item.stats) return 0;
  const goldValue = calculateItemGoldValue(item.stats);
  return calculateGoldEfficiency(goldValue, item.gold.total);
}

export function calculateBuildGoldEfficiency(items: ItemGoldInput[]): {
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
      totalGoldValue += calculateItemGoldValue(item.stats);
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
