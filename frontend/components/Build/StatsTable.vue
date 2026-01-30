<template>
  <div class="stats-table">
    <div v-if="!champion" class="py-8 text-center">
      <p class="text-text/70">{{ t('stats.selectChampionPrompt') }}</p>
    </div>

    <div v-else class="space-y-4">
      <!-- Level Selector -->
      <div class="flex items-center justify-between">
        <label class="text-sm font-semibold text-text">{{ t('stats.championLevel') }}</label>
        <select
          v-model.number="selectedLevel"
          class="rounded-lg border border-primary/50 bg-surface px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
        >
          <option v-for="level in 18" :key="level" :value="level">
            {{ t('stats.level') }} {{ level }}
          </option>
        </select>
      </div>

      <!-- Stats Table -->
      <div v-if="baseStatsAtLevel && totalStats" class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-primary/30">
              <th class="px-4 py-2 text-left text-sm font-semibold text-text">
                <div class="flex items-center gap-2">
                  <span>{{ t('stats.statColumn') }}</span>
                  <div class="info-icon-wrapper relative">
                    <div class="info-icon">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 16v-4"></path>
                        <path d="M12 8h.01"></path>
                      </svg>
                    </div>
                    <div class="info-tooltip">
                      <p class="text-xs leading-relaxed">{{ t('stats.disclaimer') }}</p>
                    </div>
                  </div>
                </div>
              </th>
              <th class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ t('stats.base') }}
              </th>
              <th class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ t('stats.itemsColumn') }}
              </th>
              <th class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ t('stats.shards') }}
              </th>
              <th class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ t('stats.total') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Basic Stats Category -->
            <tr
              v-if="basicStats.length > 0"
              class="stat-category-separator cursor-pointer hover:bg-primary/10"
              @click="showBasicStats = !showBasicStats"
            >
              <td colspan="5" class="stat-category-title">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-amber-600 dark:text-amber-500">{{
                    t('stats.categories.basic')
                  }}</span>
                  <span class="toggle-icon text-text/60" :class="{ open: showBasicStats }">▼</span>
                </div>
              </td>
            </tr>

            <template v-if="showBasicStats">
              <template v-for="stat in basicStats" :key="stat.key">
                <!-- Main stat row -->
                <tr
                  :class="[
                    'border-b border-primary/20',
                    hasDerivedStats(stat.key)
                      ? 'cursor-pointer hover:bg-primary/10'
                      : 'hover:bg-primary/5',
                  ]"
                  @click="hasDerivedStats(stat.key) && toggleDerivedStats(stat.key)"
                >
                  <td class="px-4 py-2 text-sm text-text">
                    <div class="flex items-center gap-2">
                      <span>{{ stat.label }}</span>
                      <span
                        v-if="hasDerivedStats(stat.key)"
                        class="toggle-icon text-xs text-text/60"
                        :class="{ open: expandedDerivedStats[stat.key] }"
                      >
                        ▼
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-center text-sm text-text/80">
                    {{ formatValue(stat.baseValue, stat.format) }}
                  </td>
                  <td class="px-4 py-2 text-center text-sm text-text/80">
                    {{ formatValue(stat.itemValue, stat.format) }}
                  </td>
                  <td class="px-4 py-2 text-center text-sm text-text/80">
                    {{ formatValue(stat.shardValue, stat.format) }}
                  </td>
                  <td class="px-4 py-2 text-center text-sm font-semibold text-text">
                    {{ formatValue(stat.totalValue, stat.format) }}
                  </td>
                </tr>
                <!-- Derived stats dropdown -->
                <template v-if="hasDerivedStats(stat.key) && expandedDerivedStats[stat.key]">
                  <tr
                    v-for="derivedStat in getDerivedStats(stat.key)"
                    :key="derivedStat.key"
                    class="border-b border-primary/10 bg-primary/5"
                  >
                    <td class="px-8 py-2 text-sm italic text-text/80">
                      {{ derivedStat.label }}
                    </td>
                    <td class="px-4 py-2 text-center text-sm text-text/70">
                      {{ formatValue(derivedStat.baseValue, derivedStat.format) }}
                    </td>
                    <td class="px-4 py-2 text-center text-sm text-text/70">
                      {{ formatValue(derivedStat.itemValue, derivedStat.format) }}
                    </td>
                    <td class="px-4 py-2 text-center text-sm text-text/70">
                      {{ formatValue(derivedStat.shardValue, derivedStat.format) }}
                    </td>
                    <td class="px-4 py-2 text-center text-sm font-semibold text-text/80">
                      {{ formatValue(derivedStat.totalValue, derivedStat.format) }}
                    </td>
                  </tr>
                </template>
              </template>
            </template>

            <!-- Advanced Stats Category -->
            <tr
              v-if="advancedStats.length > 0"
              class="stat-category-separator cursor-pointer hover:bg-primary/10"
              @click="showAdvancedStats = !showAdvancedStats"
            >
              <td colspan="5" class="stat-category-title">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-amber-600 dark:text-amber-500">{{
                    t('stats.categories.advanced')
                  }}</span>
                  <span class="toggle-icon text-text/60" :class="{ open: showAdvancedStats }"
                    >▼</span
                  >
                </div>
              </td>
            </tr>

            <template v-if="showAdvancedStats">
              <tr
                v-for="stat in advancedStats"
                :key="stat.key"
                class="border-b border-primary/20 hover:bg-primary/5"
              >
                <td class="px-4 py-2 text-sm text-text">{{ stat.label }}</td>
                <td class="px-4 py-2 text-center text-sm text-text/80">
                  {{ formatValue(stat.baseValue, stat.format) }}
                </td>
                <td class="px-4 py-2 text-center text-sm text-text/80">
                  {{ formatValue(stat.itemValue, stat.format) }}
                </td>
                <td class="px-4 py-2 text-center text-sm text-text/80">
                  {{ formatValue(stat.shardValue, stat.format) }}
                </td>
                <td class="px-4 py-2 text-center text-sm font-semibold text-text">
                  {{ formatValue(stat.totalValue, stat.format) }}
                </td>
              </tr>
            </template>

            <!-- Economic Stats Category -->
            <tr
              v-if="economicStats.length > 0"
              class="stat-category-separator cursor-pointer hover:bg-primary/10"
              @click="showEconomicStats = !showEconomicStats"
            >
              <td colspan="5" class="stat-category-title">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-amber-600 dark:text-amber-500">{{
                    t('stats.categories.economic')
                  }}</span>
                  <span class="toggle-icon text-text/60" :class="{ open: showEconomicStats }"
                    >▼</span
                  >
                </div>
              </td>
            </tr>

            <template v-if="showEconomicStats">
              <tr
                v-for="stat in economicStats"
                :key="stat.key"
                class="border-b border-primary/20 hover:bg-primary/5"
              >
                <td class="px-4 py-2 text-sm text-text">{{ stat.label }}</td>
                <td class="px-4 py-2 text-center text-sm text-text/80">
                  {{ formatValue(stat.baseValue, stat.format) }}
                </td>
                <td class="px-4 py-2 text-center text-sm text-text/80">
                  {{ formatValue(stat.itemValue, stat.format) }}
                </td>
                <td class="px-4 py-2 text-center text-sm text-text/80">
                  {{ formatValue(stat.shardValue, stat.format) }}
                </td>
                <td class="px-4 py-2 text-center text-sm font-semibold text-text">
                  {{ formatValue(stat.totalValue, stat.format) }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-else class="py-8 text-center text-text/70">
        <p>
          Aucune statistique à afficher. Vérifiez que le build contient un champion, des items, des
          runes et des shards.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBuildStore } from '~/stores/BuildStore'
import { calculateStats } from '~/utils/statsCalculator'
import { calculateBuildGoldEfficiency } from '~/utils/goldEfficiency'
import type { Build, Item } from '~/types/build'

const props = defineProps<{
  build?: Build | null
}>()

const { t } = useI18n()
const buildStore = useBuildStore()
const selectedLevel = ref(1)
const showBasicStats = ref(true) // Always visible by default
const showAdvancedStats = ref(false) // Condensed by default
const showEconomicStats = ref(false) // Condensed by default

// Derived stats dropdowns state
const expandedDerivedStats = ref<Record<string, boolean>>({
  health: false,
  armor: false,
  magicResist: false,
})

const champion = computed(() => props.build?.champion || buildStore.currentBuild?.champion)
const items = computed(() => props.build?.items || buildStore.currentBuild?.items || [])
const runes = computed(() => props.build?.runes || buildStore.currentBuild?.runes || null)
const shards = computed(() => props.build?.shards || buildStore.currentBuild?.shards || null)

// Calculate base stats at level
const baseStatsAtLevel = computed(() => {
  if (!champion.value) return null

  const levelMultiplier = selectedLevel.value - 1
  const base = champion.value.stats

  return {
    hp: base.hp + base.hpperlevel * levelMultiplier,
    mp: base.mp + base.mpperlevel * levelMultiplier,
    armor: base.armor + base.armorperlevel * levelMultiplier,
    spellblock: base.spellblock + base.spellblockperlevel * levelMultiplier,
    hpregen: base.hpregen + base.hpregenperlevel * levelMultiplier,
    mpregen: base.mpregen + base.mpregenperlevel * levelMultiplier,
    attackdamage: base.attackdamage + base.attackdamageperlevel * levelMultiplier,
    attackspeed: base.attackspeed * (1 + (base.attackspeedperlevel / 100) * levelMultiplier),
    movespeed: base.movespeed,
    attackrange: base.attackrange,
  }
})

// Calculate shard stats separately
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
  }

  if (shards.value) {
    // Slot 1: Adaptive Force (5008), Attack Speed (5005), Ability Haste (5007)
    if (shards.value.slot1 === 5008) {
      // Adaptive: 5.4 AD or 9 AP (simplified as AD for now - could be made adaptive based on champion)
      totals.attackDamage += 5.4
    } else if (shards.value.slot1 === 5005) {
      totals.attackSpeed += 0.1 // 10% attack speed
    } else if (shards.value.slot1 === 5007) {
      totals.abilityHaste += 8
    }

    // Slot 2: Adaptive Force (5008), Movement Speed (5006), Health per level (5002)
    if (shards.value.slot2 === 5008) {
      // Adaptive: 5.4 AD or 9 AP
      totals.attackDamage += 5.4
    } else if (shards.value.slot2 === 5006) {
      totals.percentMovementSpeed += 2.5 // 2.5% movement speed
    } else if (shards.value.slot2 === 5002) {
      // Health per level: 10-200 based on level (formula: 10 + (level - 1) * 11.176)
      const healthPerLevel = Math.round(10 + (selectedLevel.value - 1) * (190 / 17))
      totals.health += healthPerLevel
    }

    // Slot 3: Health (5001), Tenacity + Slow Resist (5003), Health per level (5002)
    if (shards.value.slot3 === 5001) {
      totals.health += 65 // Fixed 65 health
    } else if (shards.value.slot3 === 5003) {
      totals.tenacity += 0.15 // 15% tenacity and slow resist
    } else if (shards.value.slot3 === 5002) {
      // Health per level: 10-200 based on level (formula: 10 + (level - 1) * 11.176)
      const healthPerLevel = Math.round(10 + (selectedLevel.value - 1) * (190 / 17))
      totals.health += healthPerLevel
    }
  }

  return totals
})

// Calculate item stats (without shards)
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

  // Items only (exclude starter items and keep only first boots if 2)
  for (const item of filteredItemsForStats.value) {
    if (!item.stats) continue

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
    totals.cooldownReduction += item.stats.rFlatCooldownModPerLevel || 0
    totals.movementSpeed += item.stats.FlatMovementSpeedMod || 0
    totals.percentMovementSpeed += item.stats.PercentMovementSpeedMod || 0
    totals.healthRegen += item.stats.FlatHPRegenMod || 0
    totals.manaRegen += item.stats.FlatMPRegenMod || 0
    totals.armorPenetration += item.stats.rPercentArmorPenetrationMod || 0
    totals.magicPenetration += item.stats.rPercentSpellPenetrationMod || 0
    totals.lethality += (item.stats as any).FlatLethality || 0
    totals.omnivamp +=
      ((item.stats as any).FlatOmnivamp || 0) + ((item.stats as any).PercentOmnivamp || 0)
    totals.shield +=
      ((item.stats as any).FlatShield || 0) + ((item.stats as any).PercentShield || 0)
    totals.attackRange += (item.stats as any).FlatAttackRangeMod || 0
  }

  return totals
})

// Calculate gold efficiency for the build
const buildGoldEfficiency = computed(() => {
  return calculateBuildGoldEfficiency(items.value)
})

const goldValue = computed(() => buildGoldEfficiency.value.totalGoldValue)
const goldCost = computed(() => buildGoldEfficiency.value.totalGoldCost)
const goldEfficiency = computed(() => buildGoldEfficiency.value.goldEfficiency)

// Helper functions to filter items for stats calculation
const isStarterItem = (item: Item): boolean => {
  const starterItemIds = new Set([
    '1036', // Long Sword
    '1054', // Doran's Shield
    '1055', // Doran's Blade
    '1056', // Doran's Ring
    '1082', // Relic Shield
    '1083', // Cull
    '3070', // Tear of the Goddess
    '3865', // World Atlas
    '3866', // Spectral Sickle
    '3867', // Spellthief's Edge
    '1101', // Scorchclaw Pup
    '1102', // Gustwalker Hatchling
    '1103', // Mosstomper Seedling
  ])
  const starterNamePatterns = [
    'seau',
    'dark seal',
    'anneau de doran',
    'lame de doran',
    'bouclier de doran',
    'larme de la déesse',
    'cull',
    'abatteur',
    'atlas',
    'épée de voleur',
    'épée longue',
    'long sword',
    'faucheuse',
    'fragment',
  ]
  if (starterItemIds.has(item.id)) return true
  const itemNameLower = item.name.toLowerCase()
  return starterNamePatterns.some(pattern => itemNameLower.includes(pattern))
}

const isBootsItem = (item: Item): boolean => {
  if (item.tags && item.tags.includes('Boots')) return true
  const bootIds = new Set([
    '1001',
    '3005',
    '3006',
    '3009',
    '3010',
    '3020',
    '3047',
    '3111',
    '3117',
    '3158',
  ])
  if (bootIds.has(item.id)) return true
  if (item.from && item.from.some((parentId: string) => bootIds.has(parentId))) return true
  return false
}

// Filter items for stats calculation: exclude starter items and keep only first boots if 2
const filteredItemsForStats = computed(() => {
  const bootsItems = items.value.filter(item => isBootsItem(item))
  const nonStarterNonBootsItems = items.value.filter(
    item => !isStarterItem(item) && !isBootsItem(item)
  )
  // Keep only the first boots item if there are 2 (only count one pair of boots)
  const bootsForStats: Item[] = bootsItems.length > 0 ? [bootsItems[0]!] : []
  return [...nonStarterNonBootsItems, ...bootsForStats]
})

// Calculate total stats
const totalStats = computed(() => {
  if (!champion.value) return null
  return calculateStats(
    champion.value as any,
    filteredItemsForStats.value,
    runes.value,
    shards.value,
    selectedLevel.value
  )
})

// Helper to get shard value for a stat
const getShardValue = (key: string): number => {
  const shard = shardStats.value
  switch (key) {
    case 'health':
      return shard.health
    case 'attackDamage':
      return shard.attackDamage
    case 'abilityPower':
      return shard.abilityPower
    case 'armor':
      return shard.armor
    case 'magicResist':
      return shard.magicResist
    case 'attackSpeed':
      return shard.attackSpeed
    case 'movementSpeed': {
      // Movement speed from shards is percentage-based (2.5%)
      // Calculate flat value based on base movement speed
      if (!baseStatsAtLevel.value || shard.percentMovementSpeed === 0) return 0
      return baseStatsAtLevel.value.movespeed * (shard.percentMovementSpeed / 100)
    }
    case 'tenacity':
      return shard.tenacity * 100 // Convert to percentage (0.15 -> 15%)
    case 'cooldownReduction': {
      // Convert ability haste to CDR percentage
      if (shard.abilityHaste === 0) return 0
      const cdr = 1 - 1 / (1 + shard.abilityHaste / 100)
      return cdr * 100
    }
    default:
      return 0
  }
}

// Basic stats
const basicStats = computed(() => {
  if (!baseStatsAtLevel.value || !totalStats.value) return []

  const base = baseStatsAtLevel.value
  const items = itemStats.value
  const total = totalStats.value

  return [
    {
      key: 'health',
      label: t('stats.labels.health'),
      baseValue: base.hp,
      itemValue: items.health || 0,
      shardValue: getShardValue('health'),
      totalValue: total.health,
      format: 'number' as const,
    },
    {
      key: 'mana',
      label: t('stats.labels.mana'),
      baseValue: base.mp,
      itemValue: items.mana || 0,
      shardValue: 0,
      totalValue: total.mana,
      format: 'number' as const,
    },
    {
      key: 'attackDamage',
      label: t('stats.labels.attackDamage'),
      baseValue: base.attackdamage,
      itemValue: items.attackDamage || 0,
      shardValue: getShardValue('attackDamage'),
      totalValue: total.attackDamage,
      format: 'number' as const,
    },
    {
      key: 'abilityPower',
      label: t('stats.labels.abilityPower'),
      baseValue: 0,
      itemValue: items.abilityPower || 0,
      shardValue: getShardValue('abilityPower'),
      totalValue: total.abilityPower,
      format: 'number' as const,
    },
    {
      key: 'armor',
      label: t('stats.labels.armor'),
      baseValue: base.armor,
      itemValue: items.armor || 0,
      shardValue: getShardValue('armor'),
      totalValue: total.armor,
      format: 'number' as const,
    },
    {
      key: 'magicResist',
      label: t('stats.labels.magicResist'),
      baseValue: base.spellblock,
      itemValue: items.magicResist || 0,
      shardValue: getShardValue('magicResist'),
      totalValue: total.magicResist,
      format: 'number' as const,
    },
    {
      key: 'movementSpeed',
      label: t('stats.labels.movementSpeed'),
      baseValue: base.movespeed,
      itemValue: items.movementSpeed || 0,
      shardValue: getShardValue('movementSpeed'),
      totalValue: total.movementSpeed,
      format: 'number' as const,
    },
    {
      key: 'attackSpeed',
      label: t('stats.labels.attackSpeed'),
      baseValue: base.attackspeed,
      itemValue: (items.attackSpeed || 0) * 100,
      shardValue: getShardValue('attackSpeed') * 100,
      totalValue: total.attackSpeed,
      format: 'decimal' as const,
    },
  ]
})

// Advanced stats
const advancedStats = computed(() => {
  if (!baseStatsAtLevel.value || !totalStats.value) return []

  const base = baseStatsAtLevel.value
  const items = itemStats.value
  const total = totalStats.value

  return [
    {
      key: 'critChance',
      label: t('stats.labels.critChance'),
      baseValue: 0,
      itemValue: items.critChance || 0,
      shardValue: 0,
      totalValue: total.critChance * 100,
      format: 'percent' as const,
    },
    {
      key: 'critDamage',
      label: t('stats.labels.critDamage'),
      baseValue: 175,
      itemValue: items.critDamage || 0,
      shardValue: 0,
      totalValue: total.critDamage * 100,
      format: 'percent' as const,
    },
    {
      key: 'lifeSteal',
      label: t('stats.labels.lifeSteal'),
      baseValue: 0,
      itemValue: items.lifeSteal || 0,
      shardValue: 0,
      totalValue: total.lifeSteal * 100,
      format: 'percent' as const,
    },
    {
      key: 'spellVamp',
      label: t('stats.labels.spellVamp'),
      baseValue: 0,
      itemValue: items.spellVamp || 0,
      shardValue: 0,
      totalValue: total.spellVamp * 100,
      format: 'percent' as const,
    },
    {
      key: 'omnivamp',
      label: t('stats.labels.omnivamp'),
      baseValue: 0,
      itemValue: items.omnivamp || 0,
      shardValue: 0,
      totalValue: total.omnivamp * 100,
      format: 'percent' as const,
    },
    {
      key: 'cooldownReduction',
      label: t('stats.labels.cooldownReduction'),
      baseValue: 0,
      itemValue: items.cooldownReduction || 0,
      shardValue: getShardValue('cooldownReduction'),
      totalValue: total.cooldownReduction * 100,
      format: 'percent' as const,
    },
    {
      key: 'armorPenetration',
      label: t('stats.labels.armorPenetration'),
      baseValue: 0,
      itemValue: items.armorPenetration || 0,
      shardValue: 0,
      totalValue: total.armorPenetration * 100,
      format: 'percent' as const,
    },
    {
      key: 'magicPenetration',
      label: t('stats.labels.magicPenetration'),
      baseValue: 0,
      itemValue: items.magicPenetration || 0,
      shardValue: 0,
      totalValue: total.magicPenetration * 100,
      format: 'percent' as const,
    },
    {
      key: 'lethality',
      label: t('stats.labels.lethality'),
      baseValue: 0,
      itemValue: items.lethality || 0,
      shardValue: 0,
      totalValue: total.lethality,
      format: 'number' as const,
    },
    {
      key: 'tenacity',
      label: t('stats.labels.tenacity'),
      baseValue: 0,
      itemValue: items.tenacity || 0,
      shardValue: getShardValue('tenacity'),
      totalValue: total.tenacity * 100,
      format: 'percent' as const,
    },
    {
      key: 'healthRegen',
      label: t('stats.labels.healthRegen'),
      baseValue: base.hpregen,
      itemValue: items.healthRegen || 0,
      shardValue: 0,
      totalValue: total.healthRegen,
      format: 'decimal' as const,
    },
    {
      key: 'manaRegen',
      label: t('stats.labels.manaRegen'),
      baseValue: base.mpregen,
      itemValue: items.manaRegen || 0,
      shardValue: 0,
      totalValue: total.manaRegen,
      format: 'decimal' as const,
    },
    {
      key: 'attackRange',
      label: t('stats.labels.attackRange'),
      baseValue: base.attackrange,
      itemValue: items.attackRange || 0,
      shardValue: 0,
      totalValue: total.attackRange,
      format: 'number' as const,
    },
    {
      key: 'shield',
      label: t('stats.labels.shield'),
      baseValue: 0,
      itemValue: items.shield || 0,
      shardValue: 0,
      totalValue: total.shield,
      format: 'number' as const,
    },
  ]
})

// Helper to check if a stat has derived stats
const hasDerivedStats = (key: string): boolean => {
  return ['health', 'armor', 'magicResist'].includes(key)
}

// Toggle derived stats dropdown
const toggleDerivedStats = (key: string) => {
  expandedDerivedStats.value[key] = !expandedDerivedStats.value[key]
}

// Calculate stats with items only (without shards) for derived stats calculations
const statsWithItemsOnly = computed(() => {
  if (!baseStatsAtLevel.value) return null

  const base = baseStatsAtLevel.value
  const items = itemStats.value

  return {
    health: base.hp + items.health,
    armor: base.armor + items.armor,
    magicResist: base.spellblock + items.magicResist,
  }
})

// Get derived stats for a base stat
const getDerivedStats = (key: string) => {
  if (!baseStatsAtLevel.value || !totalStats.value || !statsWithItemsOnly.value) return []

  const base = baseStatsAtLevel.value
  const total = totalStats.value
  const itemsOnly = statsWithItemsOnly.value

  switch (key) {
    case 'health': {
      // Base values (champion only)
      const basePhysicalEHP = base.hp * (1 + base.armor / 100)
      const baseMagicalEHP = base.hp * (1 + base.spellblock / 100)
      const baseAverageEHP = (basePhysicalEHP + baseMagicalEHP) / 2

      // Values with items only (no shards)
      const itemsPhysicalEHP = itemsOnly.health * (1 + itemsOnly.armor / 100)
      const itemsMagicalEHP = itemsOnly.health * (1 + itemsOnly.magicResist / 100)
      const itemsAverageEHP = (itemsPhysicalEHP + itemsMagicalEHP) / 2

      // Total values (with items and shards)
      const physicalEHP = total.health * (1 + total.armor / 100)
      const magicalEHP = total.health * (1 + total.magicResist / 100)
      const averageEHP = (physicalEHP + magicalEHP) / 2

      return [
        {
          key: 'totalEffectiveHealth',
          label: t('stats.labels.totalEffectiveHealth'),
          baseValue: baseAverageEHP,
          itemValue: itemsAverageEHP - baseAverageEHP,
          shardValue: averageEHP - itemsAverageEHP,
          totalValue: averageEHP,
          format: 'number' as const,
        },
      ]
    }
    case 'armor': {
      // Base values
      const basePhysicalEHP = base.hp * (1 + base.armor / 100)
      const baseDamageReduction = (100 * base.armor) / (100 + base.armor)

      // Values with items only
      const itemsPhysicalEHP = itemsOnly.health * (1 + itemsOnly.armor / 100)
      const itemsDamageReduction = (100 * itemsOnly.armor) / (100 + itemsOnly.armor)

      // Total values
      const physicalEHP = total.health * (1 + total.armor / 100)
      const damageReduction = (100 * total.armor) / (100 + total.armor)

      return [
        {
          key: 'physicalEffectiveHealth',
          label: t('stats.labels.physicalEffectiveHealth'),
          baseValue: basePhysicalEHP,
          itemValue: itemsPhysicalEHP - basePhysicalEHP,
          shardValue: physicalEHP - itemsPhysicalEHP,
          totalValue: physicalEHP,
          format: 'number' as const,
        },
        {
          key: 'armorDamageReductionPercent',
          label: t('stats.labels.armorDamageReductionPercent'),
          baseValue: baseDamageReduction,
          itemValue: itemsDamageReduction - baseDamageReduction,
          shardValue: damageReduction - itemsDamageReduction,
          totalValue: damageReduction,
          format: 'percent' as const,
        },
      ]
    }
    case 'magicResist': {
      // Base values
      const baseMagicalEHP = base.hp * (1 + base.spellblock / 100)
      const baseDamageReduction = (100 * base.spellblock) / (100 + base.spellblock)

      // Values with items only
      const itemsMagicalEHP = itemsOnly.health * (1 + itemsOnly.magicResist / 100)
      const itemsDamageReduction = (100 * itemsOnly.magicResist) / (100 + itemsOnly.magicResist)

      // Total values
      const magicalEHP = total.health * (1 + total.magicResist / 100)
      const damageReduction = (100 * total.magicResist) / (100 + total.magicResist)

      return [
        {
          key: 'magicalEffectiveHealth',
          label: t('stats.labels.magicalEffectiveHealth'),
          baseValue: baseMagicalEHP,
          itemValue: itemsMagicalEHP - baseMagicalEHP,
          shardValue: magicalEHP - itemsMagicalEHP,
          totalValue: magicalEHP,
          format: 'number' as const,
        },
        {
          key: 'magicDamageReductionPercent',
          label: t('stats.labels.magicDamageReductionPercent'),
          baseValue: baseDamageReduction,
          itemValue: itemsDamageReduction - baseDamageReduction,
          shardValue: damageReduction - itemsDamageReduction,
          totalValue: damageReduction,
          format: 'percent' as const,
        },
      ]
    }
    default:
      return []
  }
}

// Economic stats
const economicStats = computed(() => {
  return [
    {
      key: 'goldValue',
      label: t('stats.labels.goldValue'),
      baseValue: 0,
      itemValue: goldValue.value,
      shardValue: 0,
      totalValue: goldValue.value,
      format: 'number' as const,
    },
    {
      key: 'goldCost',
      label: t('stats.labels.goldCost'),
      baseValue: 0,
      itemValue: goldCost.value,
      shardValue: 0,
      totalValue: goldCost.value,
      format: 'number' as const,
    },
    {
      key: 'goldEfficiency',
      label: t('stats.labels.goldEfficiency'),
      baseValue: 0,
      itemValue: goldEfficiency.value,
      shardValue: 0,
      totalValue: goldEfficiency.value,
      format: 'percent' as const,
    },
  ]
})

const formatValue = (value: number | string, format: 'number' | 'decimal' | 'percent'): string => {
  if (typeof value === 'string') {
    return value
  }
  if (format === 'percent') {
    return `${value.toFixed(1)}%`
  }
  if (format === 'decimal') {
    return value.toFixed(2)
  }
  return Math.round(value).toString()
}
</script>

<style scoped>
.stats-table {
  width: 100%;
}

.stat-category-separator {
  background-color: rgba(var(--color-primary-rgb), 0.1);
  border-top: 2px solid rgba(var(--color-primary-rgb), 0.3);
  border-bottom: 2px solid rgba(var(--color-primary-rgb), 0.3);
}

.stat-category-title {
  padding: 0.75rem 1rem;
}

.toggle-icon {
  transition: transform 0.2s;
  display: inline-block;
}

.toggle-icon.open {
  transform: rotate(180deg);
}

.info-icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.info-icon {
  cursor: help;
  opacity: 0.6;
  transition: opacity 0.2s;
  color: rgb(var(--rgb-text) / 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-icon-wrapper:hover .info-icon {
  opacity: 1;
  color: rgb(var(--rgb-text));
}

.info-tooltip {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 16px;
  background-color: rgb(var(--rgb-surface));
  border: 1px solid rgb(var(--rgb-primary) / 0.4);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  white-space: normal;
  width: 320px;
  max-width: 90vw;
  z-index: 10000;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s ease-in-out,
    transform 0.2s ease-in-out,
    visibility 0s 0.2s;
  transform: translateX(-50%) translateY(8px);
  visibility: hidden;
  color: rgb(var(--rgb-text));
  font-size: 0.75rem;
  line-height: 1.5;
}

.info-icon-wrapper:hover .info-tooltip {
  opacity: 1 !important;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0) !important;
  visibility: visible !important;
  transition:
    opacity 0.2s ease-in-out,
    transform 0.2s ease-in-out,
    visibility 0s;
}

.info-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgb(var(--rgb-primary) / 0.4);
  margin-top: -1px;
}

.info-tooltip::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgb(var(--rgb-surface));
  margin-top: 0;
  z-index: 1;
}
</style>
