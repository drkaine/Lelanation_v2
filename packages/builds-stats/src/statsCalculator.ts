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

export type AdaptiveStatChoice = "ad" | "ap";

export interface CalculateStatsOptions {
  /** Adaptive shard (5008) grants AD or AP. Default: ad. */
  adaptiveStat?: AdaptiveStatChoice;
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
 * @param items Full build item list (starters included). Non-drain stats use the same filter as {@link filterItemsForStats}; life steal / spell vamp / omnivamp also include starters.
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
  const filteredItems = filterItemsForStats(items);
  const itemStats = calculateItemStats(filteredItems, options);
  const starterDrain = sumStarterDrainStats(items);
  itemStats.lifeSteal += starterDrain.lifeSteal;
  itemStats.spellVamp += starterDrain.spellVamp;
  itemStats.omnivamp += starterDrain.omnivamp;
  const runeStats = calculateRuneStats(runes);
  const shardStats = calculateShardStats(shards, level, options?.adaptiveStat);
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
      (itemStats.attackSpeed || 0) +
        (shardStats.attackSpeed || 0) +
        (passiveStackStats.attackSpeed || 0)
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
    healthRegen:
      baseStats.hpregen * (1 + (itemStats.hpRegenPercent || 0) / 100) +
      (itemStats.healthRegen || 0),
    manaRegen:
      baseStats.mpregen * (1 + (itemStats.mpRegenPercent || 0) / 100) +
      (itemStats.manaRegen || 0),
    armorPenetration: (itemStats.armorPenetration || 0) / 100,
    flatArmorPenetration: itemStats.armorPenetrationFlat || 0,
    magicPenetration: (itemStats.magicPenetration || 0) / 100,
    flatMagicPenetration: itemStats.magicPenetrationFlat || 0,
    tenacity: (itemStats.tenacity || 0) / 100 + (shardStats.tenacity || 0),
    lethality: itemStats.lethality || 0,
    percentLethality: (itemStats.percentLethality || 0) / 100,
    omnivamp: (itemStats.omnivamp || 0) / 100,
    shield: itemStats.shield || 0,
    healShieldPower: (itemStats.healShieldPower || 0) / 100,
    attackRange:
      baseStats.attackrange +
      (itemStats.attackRange || 0) +
      (passiveStackStats.attackRange || 0),
    goldPer10: itemStats.goldPer10 || 0,
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
  baseStats: ChampionStats | null | undefined,
  level: number
): ChampionStats & { attackdamage: number; attackspeed: number } {
  const safe = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const stats = (baseStats ?? {}) as Partial<ChampionStats>;
  const levelMultiplier = level - 1;
  return {
    hp: safe(stats.hp) + safe(stats.hpperlevel) * levelMultiplier,
    hpperlevel: safe(stats.hpperlevel),
    mp: safe(stats.mp) + safe(stats.mpperlevel) * levelMultiplier,
    mpperlevel: safe(stats.mpperlevel),
    movespeed: safe(stats.movespeed),
    armor: safe(stats.armor) + safe(stats.armorperlevel) * levelMultiplier,
    armorperlevel: safe(stats.armorperlevel),
    spellblock:
      safe(stats.spellblock) +
      safe(stats.spellblockperlevel) * levelMultiplier,
    spellblockperlevel: safe(stats.spellblockperlevel),
    attackrange: safe(stats.attackrange),
    hpregen: safe(stats.hpregen) + safe(stats.hpregenperlevel) * levelMultiplier,
    hpregenperlevel: safe(stats.hpregenperlevel),
    mpregen: safe(stats.mpregen) + safe(stats.mpregenperlevel) * levelMultiplier,
    mpregenperlevel: safe(stats.mpregenperlevel),
    crit: safe(stats.crit) + safe(stats.critperlevel) * levelMultiplier,
    critperlevel: safe(stats.critperlevel),
    attackdamage:
      safe(stats.attackdamage) +
      safe(stats.attackdamageperlevel) * levelMultiplier,
    attackdamageperlevel: safe(stats.attackdamageperlevel),
    attackspeed:
      safe(stats.attackspeed) *
      (1 + (safe(stats.attackspeedperlevel) / 100) * levelMultiplier),
    attackspeedperlevel: safe(stats.attackspeedperlevel),
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
  /** Sum of item +% to base HP regen (e.g. 75 = +75 % of champion base). */
  hpRegenPercent: number;
  /** Sum of item +% to base mana regen. */
  mpRegenPercent: number;
  /** Passive gold per 10 s (support items / GoldPer). */
  goldPer10: number;
  armorPenetration: number;
  /** Sum of flat armor pen from items (e.g. Last Whisper line flat part). */
  armorPenetrationFlat: number;
  magicPenetration: number;
  magicPenetrationFlat: number;
  tenacity: number;
  lethality: number;
  percentLethality: number;
  omnivamp: number;
  shield: number;
  healShieldPower: number;
  attackRange: number;
};

function normalizePercentStat(value: number | undefined): number {
  const raw = value ?? 0;
  if (!Number.isFinite(raw)) return 0;
  return Math.abs(raw) <= 1 ? raw * 100 : raw;
}

function spellVampPercentFromStats(
  s: Record<string, number | undefined>
): number {
  const ext = s as Record<string, number | undefined> & {
    PercentSpellVamp?: number;
  };
  const raw = s.PercentSpellVampMod ?? ext.PercentSpellVamp;
  return normalizePercentStat(raw);
}

function omnivampPercentFromStats(
  s: Record<string, number | undefined>
): number {
  const rec = s as Record<string, number>;
  return (
    (rec.FlatOmnivamp || 0) + normalizePercentStat(rec.PercentOmnivamp)
  );
}

/** Gold / 10 s from item stats, tag GoldPer, or Data Dragon `effect.Effect1Amount`. */
export function getGoldPer10FromItem(item: Item): number {
  const s = item.stats as Record<string, number | undefined> | undefined;
  const fromStats = s?.GoldPer10 ?? s?.FlatGoldPer10s;
  if (fromStats != null && Number.isFinite(fromStats)) return fromStats;
  const tags = item.tags ?? [];
  if (!tags.includes("GoldPer")) return 0;
  const eff = (item as Item & { effect?: Record<string, string> }).effect;
  const raw = eff?.Effect1Amount;
  if (raw == null) return 0;
  const n = Number.parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Life steal / spell vamp / omnivamp from starter items only (Doran’s, etc.).
 * Core totals intentionally exclude starters; drain stats are merged separately so lane starters still show vamp in UI.
 */
export function sumStarterDrainStats(items: Item[]): {
  lifeSteal: number;
  spellVamp: number;
  omnivamp: number;
} {
  const out = { lifeSteal: 0, spellVamp: 0, omnivamp: 0 };
  for (const item of items) {
    if (!isStarterItem(item) || !item.stats) continue;
    const s = item.stats as Record<string, number | undefined>;
    out.lifeSteal += normalizePercentStat(s.PercentLifeStealMod);
    out.spellVamp += spellVampPercentFromStats(s);
    out.omnivamp += omnivampPercentFromStats(s);
  }
  return out;
}

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
    hpRegenPercent: 0,
    mpRegenPercent: 0,
    goldPer10: 0,
    armorPenetration: 0,
    armorPenetrationFlat: 0,
    magicPenetration: 0,
    magicPenetrationFlat: 0,
    tenacity: 0,
    lethality: 0,
    percentLethality: 0,
    omnivamp: 0,
    shield: 0,
    healShieldPower: 0,
    attackRange: 0,
  };

  for (const item of items) {
    totals.goldPer10 += getGoldPer10FromItem(item);
    if (!item.stats) continue;
    const s = item.stats as Record<string, number | undefined>;
    totals.health += s.FlatHPPoolMod || 0;
    totals.mana += s.FlatMPPoolMod || 0;
    totals.attackDamage += s.FlatPhysicalDamageMod || 0;
    totals.abilityPower += s.FlatMagicDamageMod || 0;
    totals.armor += s.FlatArmorMod || 0;
    totals.magicResist += s.FlatSpellBlockMod || 0;
    totals.attackSpeed += normalizePercentStat(s.PercentAttackSpeedMod) / 100;
    totals.critChance += s.FlatCritChanceMod || 0;
    totals.critDamage += s.FlatCritDamageMod || 0;
    totals.lifeSteal += normalizePercentStat(s.PercentLifeStealMod);
    totals.spellVamp += spellVampPercentFromStats(s);
    totals.cooldownReduction += s.rFlatCooldownModPerLevel || 0;
    totals.movementSpeed += s.FlatMovementSpeedMod || 0;
    totals.percentMovementSpeed += normalizePercentStat(s.PercentMovementSpeedMod);
    totals.healthRegen += s.FlatHPRegenMod || 0;
    totals.manaRegen += s.FlatMPRegenMod || 0;
    totals.hpRegenPercent += normalizePercentStat(s.PercentHPRegenMod);
    totals.mpRegenPercent += normalizePercentStat(s.PercentMPRegenMod);
    totals.armorPenetration += normalizePercentStat(s.rPercentArmorPenetrationMod);
    totals.armorPenetrationFlat +=
      (s as Record<string, number>).rFlatArmorPenetrationMod || 0;
    totals.magicPenetration += normalizePercentStat(s.rPercentSpellPenetrationMod);
    totals.magicPenetrationFlat +=
      (s as Record<string, number>).rFlatSpellPenetrationMod || 0;
    totals.tenacity +=
      normalizePercentStat((s as Record<string, number>).PercentTenacity) +
      ((s as Record<string, number>).FlatTenacity || 0);
    totals.lethality += (s as Record<string, number>).FlatLethality || 0;
    totals.percentLethality +=
      normalizePercentStat((s as Record<string, number>).rPercentLethalityMod) +
      normalizePercentStat((s as Record<string, number>).PercentLethalityMod);
    totals.omnivamp += omnivampPercentFromStats(s);
    totals.shield +=
      ((s as Record<string, number>).FlatShield || 0) +
      ((s as Record<string, number>).PercentShield || 0);
    totals.healShieldPower += normalizePercentStat(
      (s as Record<string, number>).PercentHealShieldPower
    );
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

function applyAdaptiveShardStat(
  stats: Record<string, number>,
  adaptiveStat?: AdaptiveStatChoice
): void {
  if (adaptiveStat === "ap") stats.abilityPower = (stats.abilityPower || 0) + 9;
  else stats.attackDamage = (stats.attackDamage || 0) + 5.4;
}

function calculateShardStats(
  shards: ShardSelection | null,
  level: number,
  adaptiveStat?: AdaptiveStatChoice
): Record<string, number> {
  if (!shards) return {};
  const stats: Record<string, number> = {};
  if (shards.slot1 === 5008) applyAdaptiveShardStat(stats, adaptiveStat);
  else if (shards.slot1 === 5005) stats.attackSpeed = 0.1;
  else if (shards.slot1 === 5007) stats.abilityHaste = 8;

  if (shards.slot2 === 5008) applyAdaptiveShardStat(stats, adaptiveStat);
  else if (shards.slot2 === 5006 || shards.slot2 === 5010)
    stats.percentMovementSpeed = 2.5;
  else if (shards.slot2 === 5002 || shards.slot2 === 5001)
    stats.health = Math.round(10 + (level - 1) * (190 / 17));

  if (shards.slot3 === 5011) stats.health = 65;
  else if (shards.slot3 === 5013 || shards.slot3 === 5003) stats.tenacity = 0.15;
  else if (shards.slot3 === 5002 || shards.slot3 === 5001)
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
