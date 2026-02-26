<script setup lang="ts">
import { ref, computed } from "vue";
import type { Build } from "@lelanation/shared-types";
import {
  calculateStats,
  filterItemsForStats,
  calculateBuildGoldEfficiency,
  calculateGoldValue,
} from "@lelanation/builds-stats";

const props = defineProps<{
  build: Build;
  t: (key: string) => string;
}>();

const selectedLevel = ref(18);
const showBasicStats = ref(true);
const showAdvancedStats = ref(false);
const showEconomicStats = ref(false);
const showUntouchedStats = ref(false);
const expandedDerivedStats = ref<Record<string, boolean>>({
  health: false,
  armor: false,
  magicResist: false,
});

const champion = computed(() => props.build.champion);
const items = computed(() => props.build.items || []);

const filteredItemsForStats = computed(() =>
  filterItemsForStats(items.value)
);

const baseStatsAtLevel = computed(() => {
  if (!champion.value) return null;
  const base = champion.value.stats;
  const levelMultiplier = selectedLevel.value - 1;
  return {
    hp: base.hp + base.hpperlevel * levelMultiplier,
    mp: base.mp + base.mpperlevel * levelMultiplier,
    armor: base.armor + base.armorperlevel * levelMultiplier,
    spellblock: base.spellblock + base.spellblockperlevel * levelMultiplier,
    attackdamage: base.attackdamage + base.attackdamageperlevel * levelMultiplier,
    attackspeed:
      base.attackspeed *
      (1 + (base.attackspeedperlevel / 100) * levelMultiplier),
    movespeed: base.movespeed,
    hpregen: base.hpregen + base.hpregenperlevel * levelMultiplier,
    mpregen: base.mpregen + base.mpregenperlevel * levelMultiplier,
    attackrange: base.attackrange,
  };
});

const totalStats = computed(() => {
  if (!champion.value) return null;
  return calculateStats(
    champion.value,
    filteredItemsForStats.value,
    props.build.runes || null,
    props.build.shards || null,
    selectedLevel.value
  );
});

const itemsGoldEfficiency = computed(() =>
  calculateBuildGoldEfficiency(filteredItemsForStats.value)
);

const goldValueBase = computed(() => {
  const base = baseStatsAtLevel.value;
  if (!base) return 0;
  return calculateGoldValue({
    health: base.hp,
    mana: base.mp,
    armor: base.armor,
    magicResist: base.spellblock,
    attackDamage: base.attackdamage,
    attackSpeed: base.attackspeed,
    healthRegen: base.hpregen,
    manaRegen: base.mpregen,
    movementSpeed: base.movespeed,
  });
});

const goldValueShards = computed(() => {
  const s = shardStats.value;
  const base = baseStatsAtLevel.value;
  const flatMs =
    base && s.percentMovementSpeed
      ? base.movespeed * (s.percentMovementSpeed / 100)
      : 0;
  return calculateGoldValue({
    health: s.health,
    attackDamage: s.attackDamage,
    abilityPower: s.abilityPower,
    armor: s.armor,
    magicResist: s.magicResist,
    attackSpeed: s.attackSpeed,
    abilityHaste: s.abilityHaste,
    movementSpeed: flatMs,
  });
});

const goldValueItems = computed(() => itemsGoldEfficiency.value.totalGoldValue);
const goldCostItems = computed(() => itemsGoldEfficiency.value.totalGoldCost);
const totalGoldValue = computed(
  () => goldValueBase.value + goldValueShards.value + goldValueItems.value
);
const totalGoldEfficiency = computed(() =>
  goldCostItems.value > 0
    ? (goldValueItems.value / goldCostItems.value) * 100
    : 0
);

const shardStats = computed(() => {
  const totals = {
    health: 0,
    attackDamage: 0,
    abilityPower: 0,
    armor: 0,
    magicResist: 0,
    attackSpeed: 0,
    abilityHaste: 0,
    movementSpeed: 0,
    percentMovementSpeed: 0,
    tenacity: 0,
  };
  const shards = props.build.shards;
  if (!shards) return totals;

  if (shards.slot1 === 5008) totals.attackDamage += 5.4;
  else if (shards.slot1 === 5005) totals.attackSpeed += 0.1;
  else if (shards.slot1 === 5007) totals.abilityHaste += 8;

  if (shards.slot2 === 5008) totals.attackDamage += 5.4;
  else if (shards.slot2 === 5006) totals.percentMovementSpeed += 2.5;
  else if (shards.slot2 === 5002)
    totals.health += Math.round(10 + (selectedLevel.value - 1) * (190 / 17));

  if (shards.slot3 === 5001) totals.health += 65;
  else if (shards.slot3 === 5003) totals.tenacity += 0.15;
  else if (shards.slot3 === 5002)
    totals.health += Math.round(10 + (selectedLevel.value - 1) * (190 / 17));

  return totals;
});

function getShardValue(key: string): number {
  const s = shardStats.value;
  switch (key) {
    case "health":
      return s.health;
    case "attackDamage":
      return s.attackDamage;
    case "abilityPower":
      return s.abilityPower;
    case "armor":
      return s.armor;
    case "magicResist":
      return s.magicResist;
    case "attackSpeed":
      return s.attackSpeed * 100;
    case "movementSpeed":
      return baseStatsAtLevel.value && s.percentMovementSpeed
        ? baseStatsAtLevel.value.movespeed * (s.percentMovementSpeed / 100)
        : 0;
    case "tenacity":
      return s.tenacity * 100;
    case "cooldownReduction": {
      if (s.abilityHaste === 0) return 0;
      const cdr = 1 - 1 / (1 + s.abilityHaste / 100);
      return cdr * 100;
    }
    default:
      return 0;
  }
}

const itemStats = computed(() => {
  const totals = {
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

  for (const item of filteredItemsForStats.value) {
    if (!item.stats) continue;
    const st = item.stats as Record<string, number | undefined>;
    totals.health += st.FlatHPPoolMod || 0;
    totals.mana += st.FlatMPPoolMod || 0;
    totals.attackDamage += st.FlatPhysicalDamageMod || 0;
    totals.abilityPower += st.FlatMagicDamageMod || 0;
    totals.armor += st.FlatArmorMod || 0;
    totals.magicResist += st.FlatSpellBlockMod || 0;
    totals.attackSpeed += (st.PercentAttackSpeedMod || 0) / 100;
    totals.critChance += st.FlatCritChanceMod || 0;
    totals.critDamage += st.FlatCritDamageMod || 0;
    totals.lifeSteal += st.PercentLifeStealMod || 0;
    totals.spellVamp += st.PercentSpellVampMod || 0;
    totals.cooldownReduction += st.rFlatCooldownModPerLevel || 0;
    totals.movementSpeed += st.FlatMovementSpeedMod || 0;
    totals.percentMovementSpeed += st.PercentMovementSpeedMod || 0;
    totals.healthRegen += st.FlatHPRegenMod || 0;
    totals.manaRegen += st.FlatMPRegenMod || 0;
    totals.armorPenetration += st.rPercentArmorPenetrationMod || 0;
    totals.magicPenetration += st.rPercentSpellPenetrationMod || 0;
    totals.lethality += (st as Record<string, number>).FlatLethality || 0;
    totals.omnivamp +=
      ((st as Record<string, number>).FlatOmnivamp || 0) +
      ((st as Record<string, number>).PercentOmnivamp || 0);
    totals.shield +=
      ((st as Record<string, number>).FlatShield || 0) +
      ((st as Record<string, number>).PercentShield || 0);
    totals.attackRange += (st as Record<string, number>).FlatAttackRangeMod || 0;
  }
  return totals;
});

const basicStats = computed(() => {
  if (!baseStatsAtLevel.value || !totalStats.value) return [];
  const base = baseStatsAtLevel.value;
  const items = itemStats.value;
  const total = totalStats.value;

  return [
    {
      key: "health",
      label: props.t("stats.labels.health"),
      base: base.hp,
      items: items.health || 0,
      shards: getShardValue("health"),
      total: total.health,
      format: "number" as const,
    },
    {
      key: "mana",
      label: props.t("stats.labels.mana"),
      base: base.mp,
      items: items.mana || 0,
      shards: 0,
      total: total.mana,
      format: "number" as const,
    },
    {
      key: "attackDamage",
      label: props.t("stats.labels.attackDamage"),
      base: base.attackdamage,
      items: items.attackDamage || 0,
      shards: getShardValue("attackDamage"),
      total: total.attackDamage,
      format: "number" as const,
    },
    {
      key: "abilityPower",
      label: props.t("stats.labels.abilityPower"),
      base: 0,
      items: items.abilityPower || 0,
      shards: getShardValue("abilityPower"),
      total: total.abilityPower,
      format: "number" as const,
    },
    {
      key: "armor",
      label: props.t("stats.labels.armor"),
      base: base.armor,
      items: items.armor || 0,
      shards: getShardValue("armor"),
      total: total.armor,
      format: "number" as const,
    },
    {
      key: "magicResist",
      label: props.t("stats.labels.magicResist"),
      base: base.spellblock,
      items: items.magicResist || 0,
      shards: getShardValue("magicResist"),
      total: total.magicResist,
      format: "number" as const,
    },
    {
      key: "movementSpeed",
      label: props.t("stats.labels.movementSpeed"),
      base: base.movespeed,
      items: items.movementSpeed || 0,
      shards: getShardValue("movementSpeed"),
      total: total.movementSpeed,
      format: "number" as const,
    },
    {
      key: "attackSpeed",
      label: props.t("stats.labels.attackSpeed"),
      base: base.attackspeed,
      items: (items.attackSpeed || 0) * 100,
      shards: getShardValue("attackSpeed"),
      total: total.attackSpeed,
      format: "decimal" as const,
    },
  ];
});

const advancedStats = computed(() => {
  if (!baseStatsAtLevel.value || !totalStats.value) return [];
  const base = baseStatsAtLevel.value;
  const items = itemStats.value;
  const total = totalStats.value;

  return [
    {
      key: "critChance",
      label: props.t("stats.labels.critChance"),
      base: 0,
      items: items.critChance || 0,
      shards: 0,
      total: total.critChance * 100,
      format: "percent" as const,
    },
    {
      key: "critDamage",
      label: props.t("stats.labels.critDamage"),
      base: 175,
      items: items.critDamage || 0,
      shards: 0,
      total: total.critDamage * 100,
      format: "percent" as const,
    },
    {
      key: "lifeSteal",
      label: props.t("stats.labels.lifeSteal"),
      base: 0,
      items: items.lifeSteal || 0,
      shards: 0,
      total: total.lifeSteal * 100,
      format: "percent" as const,
    },
    {
      key: "cooldownReduction",
      label: props.t("stats.labels.cooldownReduction"),
      base: 0,
      items: items.cooldownReduction || 0,
      shards: getShardValue("cooldownReduction"),
      total: total.cooldownReduction * 100,
      format: "percent" as const,
    },
    {
      key: "tenacity",
      label: props.t("stats.labels.tenacity"),
      base: 0,
      items: items.tenacity || 0,
      shards: getShardValue("tenacity"),
      total: total.tenacity * 100,
      format: "percent" as const,
    },
    {
      key: "healthRegen",
      label: props.t("stats.labels.healthRegen"),
      base: base.hpregen,
      items: items.healthRegen || 0,
      shards: 0,
      total: total.healthRegen,
      format: "decimal" as const,
    },
    {
      key: "manaRegen",
      label: props.t("stats.labels.manaRegen"),
      base: base.mpregen,
      items: items.manaRegen || 0,
      shards: 0,
      total: total.manaRegen,
      format: "decimal" as const,
    },
  ];
});

function isUntouchedStat(stat: { key: string; total: number }): boolean {
  return (
    stat.total === 0 ||
    (stat.key === "critDamage" && stat.total === 175)
  );
}

const basicStatsFiltered = computed(() =>
  basicStats.value.filter((s) => !isUntouchedStat(s))
);

const advancedStatsFiltered = computed(() =>
  advancedStats.value.filter((s) => !isUntouchedStat(s))
);

const economicStatsFiltered = computed(() =>
  economicStats.value.filter((s) => !isUntouchedStat(s))
);

const untouchedStats = computed(() => {
  const all: Array<{
    key: string;
    label: string;
    total: number;
    format: "number" | "decimal" | "percent";
  }> = [];
  for (const s of basicStats.value) {
    if (isUntouchedStat(s)) {
      all.push({ key: s.key, label: s.label, total: s.total, format: s.format });
    }
  }
  for (const s of advancedStats.value) {
    if (isUntouchedStat(s)) {
      all.push({ key: s.key, label: s.label, total: s.total, format: s.format });
    }
  }
  for (const s of economicStats.value) {
    if (isUntouchedStat(s)) {
      all.push({ key: s.key, label: s.label, total: s.total, format: s.format });
    }
  }
  return all;
});

const economicStats = computed(() => [
  {
    key: "goldValue",
    label: props.t("stats.labels.goldValue"),
    base: goldValueBase.value,
    items: goldValueItems.value,
    shards: goldValueShards.value,
    total: totalGoldValue.value,
    format: "number" as const,
  },
  {
    key: "goldCost",
    label: props.t("stats.labels.goldCost"),
    base: 0,
    items: goldCostItems.value,
    shards: 0,
    total: goldCostItems.value,
    format: "number" as const,
  },
  {
    key: "goldEfficiency",
    label: props.t("stats.labels.goldEfficiency"),
    base: 0,
    items:
      goldCostItems.value > 0
        ? (goldValueItems.value / goldCostItems.value) * 100
        : 0,
    shards: 0,
    total: totalGoldEfficiency.value,
    format: "percent" as const,
  },
]);

function formatValue(
  value: number,
  format: "number" | "decimal" | "percent"
): string {
  if (format === "percent") return `${value.toFixed(1)}%`;
  if (format === "decimal") return value.toFixed(2);
  return Math.round(value).toString();
}

function hasDerivedStats(key: string): boolean {
  return ["health", "armor", "magicResist"].includes(key);
}

function toggleDerivedStats(key: string) {
  expandedDerivedStats.value[key] = !expandedDerivedStats.value[key];
}

const statsWithItemsOnly = computed(() => {
  const base = baseStatsAtLevel.value;
  const items = itemStats.value;
  if (!base) return null;
  return {
    health: base.hp + (items.health || 0),
    armor: base.armor + (items.armor || 0),
    magicResist: base.spellblock + (items.magicResist || 0),
  };
});

function getDerivedStats(key: string): Array<{
  key: string;
  label: string;
  base: number;
  items: number;
  shards: number;
  total: number;
  format: "number" | "percent";
}> {
  const base = baseStatsAtLevel.value;
  const total = totalStats.value;
  const itemsOnly = statsWithItemsOnly.value;
  if (!base || !total || !itemsOnly) return [];

  switch (key) {
    case "health": {
      const basePhysicalEHP = base.hp * (1 + base.armor / 100);
      const baseMagicalEHP = base.hp * (1 + base.spellblock / 100);
      const baseAverageEHP = (basePhysicalEHP + baseMagicalEHP) / 2;
      const itemsPhysicalEHP = itemsOnly.health * (1 + itemsOnly.armor / 100);
      const itemsMagicalEHP =
        itemsOnly.health * (1 + itemsOnly.magicResist / 100);
      const itemsAverageEHP = (itemsPhysicalEHP + itemsMagicalEHP) / 2;
      const physicalEHP = total.health * (1 + total.armor / 100);
      const magicalEHP = total.health * (1 + total.magicResist / 100);
      const averageEHP = (physicalEHP + magicalEHP) / 2;
      return [
        {
          key: "totalEffectiveHealth",
          label: props.t("stats.labels.totalEffectiveHealth"),
          base: baseAverageEHP,
          items: itemsAverageEHP - baseAverageEHP,
          shards: averageEHP - itemsAverageEHP,
          total: averageEHP,
          format: "number" as const,
        },
      ];
    }
    case "armor": {
      const basePhysicalEHP = base.hp * (1 + base.armor / 100);
      const baseDamageReduction = (100 * base.armor) / (100 + base.armor);
      const itemsPhysicalEHP = itemsOnly.health * (1 + itemsOnly.armor / 100);
      const itemsDamageReduction =
        (100 * itemsOnly.armor) / (100 + itemsOnly.armor);
      const physicalEHP = total.health * (1 + total.armor / 100);
      const damageReduction = (100 * total.armor) / (100 + total.armor);
      return [
        {
          key: "physicalEffectiveHealth",
          label: props.t("stats.labels.physicalEffectiveHealth"),
          base: basePhysicalEHP,
          items: itemsPhysicalEHP - basePhysicalEHP,
          shards: physicalEHP - itemsPhysicalEHP,
          total: physicalEHP,
          format: "number" as const,
        },
        {
          key: "armorDamageReductionPercent",
          label: props.t("stats.labels.armorDamageReductionPercent"),
          base: baseDamageReduction,
          items: itemsDamageReduction - baseDamageReduction,
          shards: damageReduction - itemsDamageReduction,
          total: damageReduction,
          format: "percent" as const,
        },
      ];
    }
    case "magicResist": {
      const baseMagicalEHP = base.hp * (1 + base.spellblock / 100);
      const baseDamageReduction =
        (100 * base.spellblock) / (100 + base.spellblock);
      const itemsMagicalEHP =
        itemsOnly.health * (1 + itemsOnly.magicResist / 100);
      const itemsDamageReduction =
        (100 * itemsOnly.magicResist) / (100 + itemsOnly.magicResist);
      const magicalEHP = total.health * (1 + total.magicResist / 100);
      const damageReduction =
        (100 * total.magicResist) / (100 + total.magicResist);
      return [
        {
          key: "magicalEffectiveHealth",
          label: props.t("stats.labels.magicalEffectiveHealth"),
          base: baseMagicalEHP,
          items: itemsMagicalEHP - baseMagicalEHP,
          shards: magicalEHP - itemsMagicalEHP,
          total: magicalEHP,
          format: "number" as const,
        },
        {
          key: "magicDamageReductionPercent",
          label: props.t("stats.labels.magicDamageReductionPercent"),
          base: baseDamageReduction,
          items: itemsDamageReduction - baseDamageReduction,
          shards: damageReduction - itemsDamageReduction,
          total: damageReduction,
          format: "percent" as const,
        },
      ];
    }
    default:
      return [];
  }
}
</script>

<template>
  <div class="build-stats-table">
    <div v-if="!champion" class="stats-empty">
      <p>{{ props.t('stats.selectChampionPrompt') }}</p>
    </div>

    <div v-else class="stats-content">
      <div class="level-selector">
        <label class="level-label">{{ props.t('stats.championLevel') }}</label>
        <select
          v-model.number="selectedLevel"
          class="level-select"
        >
          <option v-for="level in 18" :key="level" :value="level">
            {{ props.t('stats.level') }} {{ level }}
          </option>
        </select>
      </div>

      <div v-if="baseStatsAtLevel && totalStats" class="stats-table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th class="col-stat">{{ props.t('stats.statColumn') }}</th>
              <th class="col-num">{{ props.t('stats.base') }}</th>
              <th class="col-num">{{ props.t('stats.itemsColumn') }}</th>
              <th class="col-num">{{ props.t('stats.shards') }}</th>
              <th class="col-num">{{ props.t('stats.total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="basicStatsFiltered.length > 0"
              class="category-row category-clickable"
              @click="showBasicStats = !showBasicStats"
            >
              <td colspan="5" class="category-title">
                <span>{{ props.t('stats.categories.basic') }}</span>
                <span class="toggle-icon" :class="{ open: showBasicStats }">▼</span>
              </td>
            </tr>
            <template v-if="showBasicStats">
              <template v-for="stat in basicStatsFiltered" :key="stat.key">
                <tr
                  :class="[
                    'stat-row',
                    hasDerivedStats(stat.key) ? 'stat-clickable' : '',
                  ]"
                  @click="hasDerivedStats(stat.key) && toggleDerivedStats(stat.key)"
                >
                  <td class="col-stat">
                    <span>{{ stat.label }}</span>
                    <span
                      v-if="hasDerivedStats(stat.key)"
                      class="toggle-icon toggle-small"
                      :class="{ open: expandedDerivedStats[stat.key] }"
                    >
                      ▼
                    </span>
                  </td>
                  <td class="col-num">{{ formatValue(stat.base, stat.format) }}</td>
                  <td class="col-num">{{ formatValue(stat.items, stat.format) }}</td>
                  <td class="col-num">{{ formatValue(stat.shards, stat.format) }}</td>
                  <td class="col-num total">{{ formatValue(stat.total, stat.format) }}</td>
                </tr>
                <tr
                  v-for="derived in getDerivedStats(stat.key)"
                  v-show="expandedDerivedStats[stat.key]"
                  :key="'derived-' + stat.key + '-' + derived.key"
                  class="stat-row stat-derived"
                >
                  <td class="col-stat col-derived">{{ derived.label }}</td>
                  <td class="col-num">{{ formatValue(derived.base, derived.format) }}</td>
                  <td class="col-num">{{ formatValue(derived.items, derived.format) }}</td>
                  <td class="col-num">{{ formatValue(derived.shards, derived.format) }}</td>
                  <td class="col-num total">{{ formatValue(derived.total, derived.format) }}</td>
                </tr>
              </template>
            </template>

            <tr
              v-if="advancedStatsFiltered.length > 0"
              class="category-row category-clickable"
              @click="showAdvancedStats = !showAdvancedStats"
            >
              <td colspan="5" class="category-title">
                <span>{{ props.t('stats.categories.advanced') }}</span>
                <span class="toggle-icon" :class="{ open: showAdvancedStats }">▼</span>
              </td>
            </tr>
            <template v-if="showAdvancedStats">
              <tr
                v-for="stat in advancedStatsFiltered"
                :key="stat.key"
                class="stat-row"
              >
                <td class="col-stat">{{ stat.label }}</td>
                <td class="col-num">{{ formatValue(stat.base, stat.format) }}</td>
                <td class="col-num">{{ formatValue(stat.items, stat.format) }}</td>
                <td class="col-num">{{ formatValue(stat.shards, stat.format) }}</td>
                <td class="col-num total">{{ formatValue(stat.total, stat.format) }}</td>
              </tr>
            </template>

            <tr class="category-row category-clickable" @click="showEconomicStats = !showEconomicStats">
              <td colspan="5" class="category-title">
                <span>{{ props.t('stats.categories.economic') }}</span>
                <span class="toggle-icon" :class="{ open: showEconomicStats }">▼</span>
              </td>
            </tr>
            <template v-if="showEconomicStats">
              <tr
                v-for="stat in economicStatsFiltered"
                :key="stat.key"
                class="stat-row"
              >
                <td class="col-stat">{{ stat.label }}</td>
                <td class="col-num">{{ formatValue(stat.base, stat.format) }}</td>
                <td class="col-num">{{ formatValue(stat.items, stat.format) }}</td>
                <td class="col-num">{{ formatValue(stat.shards, stat.format) }}</td>
                <td class="col-num total">{{ formatValue(stat.total, stat.format) }}</td>
              </tr>
            </template>

            <tr
              v-if="untouchedStats.length > 0"
              class="category-row category-clickable"
              @click="showUntouchedStats = !showUntouchedStats"
            >
              <td colspan="5" class="category-title">
                <span>{{ props.t('stats.categories.untouched') }}</span>
                <span class="toggle-icon" :class="{ open: showUntouchedStats }">▼</span>
              </td>
            </tr>
            <template v-if="showUntouchedStats">
              <tr
                v-for="stat in untouchedStats"
                :key="'untouched-' + stat.key"
                class="stat-row untouched-row"
              >
                <td class="col-stat">{{ stat.label }}</td>
                <td class="col-num" colspan="2">—</td>
                <td class="col-num">—</td>
                <td class="col-num total">{{ formatValue(stat.total, stat.format) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else class="stats-empty">
        <p>{{ props.t('stats.selectChampionAndItems') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.build-stats-table {
  width: 100%;
  color: #f0e6d2;
}

.stats-empty {
  padding: 1rem;
  text-align: center;
  color: rgba(240, 230, 210, 0.7);
  font-size: 0.9rem;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.level-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.level-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #f0e6d2;
}

.level-select {
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.5);
  background: rgba(30, 40, 45, 0.8);
  color: #c8aa6e;
  font-size: 0.85rem;
}

.stats-table-wrap {
  overflow-x: auto;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.stats-table th,
.stats-table td {
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid rgba(200, 155, 60, 0.2);
}

.stats-table th {
  text-align: left;
  font-weight: 600;
  color: #c8aa6e;
}

.col-stat {
  min-width: 140px;
}

.col-num {
  text-align: center;
  min-width: 60px;
}

.col-num.total {
  font-weight: 600;
  color: #f0e6d2;
}

.category-row {
  background: rgba(200, 155, 60, 0.1);
  border-top: 1px solid rgba(200, 155, 60, 0.3);
}

.category-title {
  padding: 0.5rem 0.75rem !important;
  font-weight: 600;
  color: #c89b3c;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.category-clickable {
  cursor: pointer;
}
.category-clickable:hover {
  background: rgba(200, 155, 60, 0.15);
}

.toggle-icon {
  font-size: 0.7em;
  opacity: 0.7;
  transition: transform 0.2s;
  display: inline-block;
}
.toggle-icon.open {
  transform: rotate(180deg);
}
.toggle-small {
  margin-left: 0.35rem;
  font-size: 0.65em;
}

.stat-clickable {
  cursor: pointer;
}
.stat-clickable:hover {
  background: rgba(200, 155, 60, 0.08);
}

.stat-derived {
  background: rgba(200, 155, 60, 0.05);
}
.col-derived {
  padding-left: 1.5rem !important;
  font-style: italic;
  color: rgba(240, 230, 210, 0.85);
}

.stat-row:hover {
  background: rgba(200, 155, 60, 0.05);
}
.stat-derived:hover {
  background: rgba(200, 155, 60, 0.08);
}
</style>
