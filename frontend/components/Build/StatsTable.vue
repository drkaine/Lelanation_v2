<template>
  <div class="stats-table">
    <div v-if="!champion" class="py-8 text-center">
      <p class="text-text/70">{{ t('stats.selectChampionPrompt') }}</p>
    </div>

    <div v-else class="space-y-4">
      <div class="stats-infobox rounded-lg border border-primary/40 p-3">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <label class="stats-gold-text text-sm font-semibold">Level:</label>
            <select
              v-model.number="selectedLevel"
              class="rounded-lg border border-primary/60 bg-background/40 px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
            >
              <option v-for="level in 20" :key="level" :value="level">
                {{ level }}
              </option>
            </select>
          </div>
          <div class="text-sm font-semibold text-text/90">Base statistics</div>
          <div v-if="!hideCategoryTabs" class="scrollable-tabs-scroll-wrap min-w-0 max-w-full">
            <div class="stats-tabs scrollable-tabs-nav">
              <button
                type="button"
                class="stats-tab"
                :class="{ 'stats-tab--active': activeCategory === 'basic' }"
                @click="setStatsCategory('basic')"
              >
                {{ t('stats.categories.basic') }}
              </button>
              <button
                type="button"
                class="stats-tab"
                :class="{ 'stats-tab--active': activeCategory === 'advanced' }"
                @click="setStatsCategory('advanced')"
              >
                {{ t('stats.categories.advanced') }}
              </button>
              <button
                type="button"
                class="stats-tab"
                :class="{ 'stats-tab--active': activeCategory === 'economic' }"
                @click="setStatsCategory('economic')"
              >
                {{ t('stats.categories.economic') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Stats Table -->
        <div v-if="baseStatsAtLevel && totalStats" class="stats-table-scroll">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-primary/30">
                <th class="stats-gold-text px-4 py-2 text-left text-sm font-semibold">
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
                      <div class="info-tooltip-disclaimer">
                        <div class="info-tooltip-content">{{ t('stats.disclaimer') }}</div>
                      </div>
                    </div>
                  </div>
                </th>
                <th class="stats-gold-text px-4 py-2 text-center text-sm font-semibold">
                  {{ t('stats.base') }}
                </th>
                <th class="stats-gold-text px-4 py-2 text-center text-sm font-semibold">
                  {{ t('stats.itemsColumn') }}
                </th>
                <th class="stats-gold-text px-4 py-2 text-center text-sm font-semibold">
                  {{ t('stats.shards') }}
                </th>
                <th class="stats-gold-text px-4 py-2 text-center text-sm font-semibold">
                  {{ t('stats.total') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="stat in currentCategoryStats" :key="stat.key">
                <tr
                  :class="[
                    'border-b border-primary/20',
                    activeCategory === 'basic' && hasDerivedStats(stat.key)
                      ? 'cursor-pointer hover:bg-primary/10'
                      : 'hover:bg-primary/5',
                  ]"
                  @click="
                    activeCategory === 'basic' &&
                    hasDerivedStats(stat.key) &&
                    toggleDerivedStats(stat.key)
                  "
                >
                  <td class="px-4 py-2 text-sm text-text">
                    <div class="flex items-center gap-2">
                      <span
                        class="stat-inline-icon"
                        :class="getStatIconToneClass(stat.key)"
                        aria-hidden="true"
                      >
                        <img
                          v-if="getStatIconSrc(stat.key)"
                          :src="getStatIconSrc(stat.key) || undefined"
                          alt=""
                          :class="['stat-inline-icon-image', getStatIconImageClass(stat.key)]"
                        />
                        <span v-else>•</span>
                      </span>
                      <span>{{ stat.label }}</span>
                      <div v-if="hasStatFormula(stat.key)" class="info-icon-wrapper relative">
                        <div class="info-icon">
                          <svg
                            width="12"
                            height="12"
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
                          <div class="info-tooltip-content">{{ getStatFormula(stat.key) }}</div>
                        </div>
                      </div>
                      <span
                        v-if="activeCategory === 'basic' && hasDerivedStats(stat.key)"
                        class="toggle-icon text-xs text-text/60"
                        :class="{ open: expandedDerivedStats[stat.key] }"
                      >
                        ▼
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-center text-sm text-sky-300">
                    {{ formatValue(stat.baseValue, stat.format) }}
                  </td>
                  <td class="px-4 py-2 text-center text-sm text-sky-300">
                    {{
                      formatValue(stat.itemValue, stat.format, getStatFormatExtra(stat, 'items'))
                    }}
                  </td>
                  <td class="px-4 py-2 text-center text-sm text-sky-300">
                    {{ formatValue(stat.shardValue, stat.format) }}
                  </td>
                  <td class="px-4 py-2 text-center text-sm font-semibold text-text">
                    {{
                      formatValue(stat.totalValue, stat.format, getStatFormatExtra(stat, 'total'))
                    }}
                  </td>
                </tr>
                <template
                  v-if="
                    activeCategory === 'basic' &&
                    hasDerivedStats(stat.key) &&
                    expandedDerivedStats[stat.key]
                  "
                >
                  <tr
                    v-for="derivedStat in getDerivedStats(stat.key)"
                    :key="derivedStat.key"
                    class="border-b border-primary/10 bg-primary/5"
                  >
                    <td class="px-8 py-2 text-sm italic text-text/80">
                      <span class="inline-flex items-center gap-2">
                        <span
                          class="stat-inline-icon"
                          :class="getStatIconToneClass(derivedStat.key)"
                          aria-hidden="true"
                        >
                          <img
                            v-if="getStatIconSrc(derivedStat.key)"
                            :src="getStatIconSrc(derivedStat.key) || undefined"
                            alt=""
                            :class="[
                              'stat-inline-icon-image',
                              getStatIconImageClass(derivedStat.key),
                            ]"
                          />
                          <span v-else>•</span>
                        </span>
                        <span>{{ derivedStat.label }}</span>
                        <div
                          v-if="hasStatFormula(derivedStat.key)"
                          class="info-icon-wrapper relative"
                        >
                          <div class="info-icon">
                            <svg
                              width="12"
                              height="12"
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
                            <div class="info-tooltip-content">
                              {{ getStatFormula(derivedStat.key) }}
                            </div>
                          </div>
                        </div>
                      </span>
                    </td>
                    <td class="px-4 py-2 text-center text-sm text-sky-300/90">
                      {{ formatValue(derivedStat.baseValue, derivedStat.format) }}
                    </td>
                    <td class="px-4 py-2 text-center text-sm text-sky-300/90">
                      {{ formatValue(derivedStat.itemValue, derivedStat.format) }}
                    </td>
                    <td class="px-4 py-2 text-center text-sm text-sky-300/90">
                      {{ formatValue(derivedStat.shardValue, derivedStat.format) }}
                    </td>
                    <td class="px-4 py-2 text-center text-sm font-semibold text-text/80">
                      {{ formatValue(derivedStat.totalValue, derivedStat.format) }}
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
        <div v-else class="py-8 text-center text-text/70">
          <p>
            Aucune statistique à afficher. Vérifiez que le build contient un champion, des items,
            des runes et des shards.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  calculateStats,
  filterItemsForStats,
  sumStarterDrainStats,
  getGoldPer10FromItem,
  calculateBuildGoldEfficiency,
} from '@lelanation/builds-stats'
import { formatLethality, formatPenetrationPercentFlat } from '~/utils/formatItemStats'
import { useBuildStore } from '~/stores/BuildStore'
import { useItemsStore } from '~/stores/ItemsStore'
import type { Build } from '~/types/build'

const props = withDefaults(
  defineProps<{
    build?: Build | null
    /** Masquer les onglets dans l’infobox (ex. onglets dans la toolbar de la page info) */
    hideCategoryTabs?: boolean
    category?: 'basic' | 'advanced' | 'economic'
  }>(),
  {
    hideCategoryTabs: false,
  }
)

const emit = defineEmits<{
  'update:category': [value: 'basic' | 'advanced' | 'economic']
}>()

const { t } = useI18n()
const buildStore = useBuildStore()
const itemsStore = useItemsStore()
const selectedLevel = ref(1)
const activeCategory = ref<'basic' | 'advanced' | 'economic'>('basic')

const normalizePercentStat = (value: number | undefined): number => {
  const raw = value ?? 0
  if (!Number.isFinite(raw)) return 0
  return Math.abs(raw) <= 1 ? raw * 100 : raw
}

/** Bonus MS des objets : (base + flat) × (1 + % objets / 100) − base (aligné sur builds-stats). */
function movementSpeedItemBonus(baseMs: number, itemFlat: number, itemPct: number): number {
  const f = itemFlat || 0
  const p = itemPct || 0
  return (baseMs + f) * (1 + p / 100) - baseMs
}

/** Bonus MS des shards % sur (base + flat objets), cohérent avec le total. */
function movementSpeedShardBonus(baseMs: number, itemFlat: number, shardPct: number): number {
  return (baseMs + (itemFlat || 0)) * ((shardPct || 0) / 100)
}

watch(
  () => props.category,
  c => {
    if (c !== undefined) activeCategory.value = c
  },
  { immediate: true }
)

function setStatsCategory(c: 'basic' | 'advanced' | 'economic') {
  activeCategory.value = c
  emit('update:category', c)
}

// Derived stats dropdowns state
const expandedDerivedStats = ref<Record<string, boolean>>({
  health: false,
  armor: false,
  magicResist: false,
})

// Utiliser displayedBuild pour que les stats reflètent toujours la variante affichée
const _activeBuild = computed(
  () => props.build || buildStore.displayedBuild || buildStore.currentBuild
)
const champion = computed(() => _activeBuild.value?.champion ?? null)
/** Enrich build items with catalogue data (gold, tags, stats) — builds/API often store ItemRef-like rows without gold, which breaks gold value / cost / efficiency. */
const items = computed(() => {
  const buildItems = _activeBuild.value?.items ?? []
  return buildItems.map(item => {
    const latest = itemsStore.items.find(i => i.id === item.id)
    if (!latest) return item
    return {
      ...latest,
      ...item,
      stats: latest.stats ?? item.stats,
      gold: latest.gold ?? item.gold,
      image: latest.image ?? item.image,
      tags: latest.tags ?? item.tags,
    }
  })
})
const runes = computed(() => _activeBuild.value?.runes ?? null)
const shards = computed(() => _activeBuild.value?.shards ?? null)

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

    // Slot 2: Adaptive (5008), Move Speed (5010 / 5006), Scaling HP (5001 / 5002)
    if (shards.value.slot2 === 5008) {
      // Adaptive: 5.4 AD or 9 AP
      totals.attackDamage += 5.4
    } else if (shards.value.slot2 === 5006 || shards.value.slot2 === 5010) {
      totals.percentMovementSpeed += 2.5 // 2.5% movement speed
    } else if (shards.value.slot2 === 5002 || shards.value.slot2 === 5001) {
      // Health per level: 10-200 based on level (formula: 10 + (level - 1) * 11.176)
      const healthPerLevel = Math.round(10 + (selectedLevel.value - 1) * (190 / 17))
      totals.health += healthPerLevel
    }

    // Slot 3: flat PV (5011 ; ancien client utilisait 5001), ténacité (5013 / 5003), croissance (5001 / 5002)
    if (shards.value.slot3 === 5011) {
      totals.health += 65
    } else if (shards.value.slot3 === 5013 || shards.value.slot3 === 5003) {
      totals.tenacity += 0.15
    } else if (shards.value.slot3 === 5002 || shards.value.slot3 === 5001) {
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
    armorPenetrationFlat: 0,
    magicPenetration: 0,
    magicPenetrationFlat: 0,
    tenacity: 0,
    lethality: 0,
    percentLethality: 0,
    omnivamp: 0,
    shield: 0,
    attackRange: 0,
    hpRegenPercent: 0,
    mpRegenPercent: 0,
    healShieldPower: 0,
    goldPer10: 0,
  }

  // Items only (exclude starter items and keep only first boots if 2)
  for (const item of filteredItemsForStats.value) {
    totals.goldPer10 += getGoldPer10FromItem(item)
    if (!item.stats) continue

    totals.health += item.stats.FlatHPPoolMod || 0
    totals.mana += item.stats.FlatMPPoolMod || 0
    totals.attackDamage += item.stats.FlatPhysicalDamageMod || 0
    totals.abilityPower += item.stats.FlatMagicDamageMod || 0
    totals.armor += item.stats.FlatArmorMod || 0
    totals.magicResist += item.stats.FlatSpellBlockMod || 0
    totals.attackSpeed += normalizePercentStat(item.stats.PercentAttackSpeedMod) / 100
    totals.critChance += item.stats.FlatCritChanceMod || 0
    totals.critDamage += item.stats.FlatCritDamageMod || 0
    totals.lifeSteal += normalizePercentStat(item.stats.PercentLifeStealMod)
    totals.spellVamp += normalizePercentStat(
      item.stats.PercentSpellVampMod ??
        (item.stats as { PercentSpellVamp?: number }).PercentSpellVamp
    )
    totals.cooldownReduction += item.stats.rFlatCooldownModPerLevel || 0
    totals.movementSpeed += item.stats.FlatMovementSpeedMod || 0
    totals.percentMovementSpeed += normalizePercentStat(item.stats.PercentMovementSpeedMod)
    totals.healthRegen += item.stats.FlatHPRegenMod || 0
    totals.manaRegen += item.stats.FlatMPRegenMod || 0
    totals.hpRegenPercent += normalizePercentStat(item.stats.PercentHPRegenMod)
    totals.mpRegenPercent += normalizePercentStat(item.stats.PercentMPRegenMod)
    totals.healShieldPower += normalizePercentStat(
      (item.stats as { PercentHealShieldPower?: number }).PercentHealShieldPower
    )
    totals.armorPenetration += normalizePercentStat(item.stats.rPercentArmorPenetrationMod)
    totals.armorPenetrationFlat +=
      ((item.stats as Record<string, number | undefined>).rFlatArmorPenetrationMod as number) || 0
    totals.magicPenetration += normalizePercentStat(item.stats.rPercentSpellPenetrationMod)
    totals.magicPenetrationFlat +=
      ((item.stats as Record<string, number | undefined>).rFlatSpellPenetrationMod as number) || 0
    totals.tenacity +=
      normalizePercentStat((item.stats as any).PercentTenacity ?? 0) +
      ((item.stats as any).FlatTenacity || 0)
    totals.lethality += (item.stats as any).FlatLethality || 0
    totals.percentLethality +=
      normalizePercentStat((item.stats as any).rPercentLethalityMod ?? 0) +
      normalizePercentStat((item.stats as any).PercentLethalityMod ?? 0)
    totals.omnivamp +=
      ((item.stats as any).FlatOmnivamp || 0) +
      normalizePercentStat((item.stats as any).PercentOmnivamp || 0)
    totals.shield +=
      ((item.stats as any).FlatShield || 0) + ((item.stats as any).PercentShield || 0)
    totals.attackRange += (item.stats as any).FlatAttackRangeMod || 0
  }

  const drain = sumStarterDrainStats(items.value)
  totals.lifeSteal += drain.lifeSteal
  totals.spellVamp += drain.spellVamp
  totals.omnivamp += drain.omnivamp

  return totals
})

// Calculate gold efficiency for the build (use filtered items)
const buildGoldEfficiency = computed(() => {
  return calculateBuildGoldEfficiency(filteredItemsForStats.value)
})

const goldValue = computed(() => buildGoldEfficiency.value.totalGoldValue)
const goldCost = computed(() => buildGoldEfficiency.value.totalGoldCost)
const goldEfficiency = computed(() => buildGoldEfficiency.value.goldEfficiency)

// Filter items for stats calculation: exclude starter items and keep only first boots if 2
const filteredItemsForStats = computed(() => filterItemsForStats(items.value))

// Calculate total stats
const totalStats = computed(() => {
  if (!champion.value) return null
  return calculateStats(champion.value, items.value, runes.value, shards.value, selectedLevel.value)
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
      itemValue: movementSpeedItemBonus(
        base.movespeed,
        items.movementSpeed || 0,
        items.percentMovementSpeed || 0
      ),
      shardValue: movementSpeedShardBonus(
        base.movespeed,
        items.movementSpeed || 0,
        shardStats.value.percentMovementSpeed || 0
      ),
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
      key: 'cooldownReduction',
      label: t('stats.labels.abilityHaste'),
      baseValue: 0,
      itemValue: items.cooldownReduction || 0,
      shardValue: shardStats.value.abilityHaste || 0,
      totalValue: (items.cooldownReduction || 0) + (shardStats.value.abilityHaste || 0),
      format: 'number' as const,
    },
    {
      key: 'armorPenetration',
      label: `${t('stats.labels.armorPenetration')} ${t('stats.penetrationValueLegend')}`,
      baseValue: 0,
      itemValue: items.armorPenetration || 0,
      itemValueFlat: items.armorPenetrationFlat || 0,
      shardValue: 0,
      totalValue: total.armorPenetration * 100,
      totalValueFlat: total.flatArmorPenetration,
      format: 'penetration' as const,
    },
    {
      key: 'magicPenetration',
      label: `${t('stats.labels.magicPenetration')} ${t('stats.penetrationValueLegend')}`,
      baseValue: 0,
      itemValue: items.magicPenetration || 0,
      itemValueFlat: items.magicPenetrationFlat || 0,
      shardValue: 0,
      totalValue: total.magicPenetration * 100,
      totalValueFlat: total.flatMagicPenetration,
      format: 'penetration' as const,
    },
    {
      key: 'lethality',
      label: t('stats.labels.lethality'),
      baseValue: 0,
      itemValue: items.lethality || 0,
      itemPercentLethality: (items.percentLethality || 0) * 100,
      shardValue: 0,
      totalValue: total.lethality,
      totalPercentLethality: (total.percentLethality ?? 0) * 100,
      format: 'lethality' as const,
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
      itemValue: (items.healthRegen || 0) + (base.hpregen * (items.hpRegenPercent || 0)) / 100,
      shardValue: 0,
      totalValue: total.healthRegen,
      format: 'decimal' as const,
    },
    {
      key: 'manaRegen',
      label: t('stats.labels.manaRegen'),
      baseValue: base.mpregen,
      itemValue: (items.manaRegen || 0) + (base.mpregen * (items.mpRegenPercent || 0)) / 100,
      shardValue: 0,
      totalValue: total.manaRegen,
      format: 'decimal' as const,
    },
    {
      key: 'healShieldPower',
      label: t('stats.labels.healShieldPower'),
      baseValue: 0,
      itemValue: items.healShieldPower || 0,
      shardValue: 0,
      totalValue: total.healShieldPower * 100,
      format: 'percent' as const,
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
  const gp10 = totalStats.value?.goldPer10 ?? 0
  const itemsGp10 = itemStats.value.goldPer10 ?? 0
  return [
    {
      key: 'goldPer10',
      label: t('stats.labels.goldGeneration'),
      baseValue: 0,
      itemValue: itemsGp10,
      shardValue: 0,
      totalValue: gp10,
      format: 'number' as const,
    },
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

const currentCategoryStats = computed(() => {
  if (activeCategory.value === 'advanced') return advancedStats.value
  if (activeCategory.value === 'economic') return economicStats.value
  return basicStats.value
})

const statIconByKey: Record<string, string> = {
  health: '/icons/statsicon/Health.svg',
  mana: '/icons/statsicon/Mana.svg',
  attackDamage: '/icons/statsicon/AD.png',
  abilityPower: '/icons/statsicon/ap.png',
  armor: '/icons/statsicon/Armor.png',
  magicResist: '/icons/statsicon/Magic_resistance.png',
  movementSpeed: '/icons/statsicon/Movement_speed.png',
  healthRegen: '/icons/statsicon/Health_regeneration.svg',
  attackSpeed: '/icons/statsicon/AS.png',
  critChance: '/icons/statsicon/Critical_strike_damage.png',
  critDamage: '/icons/statsicon/Critical_strike.png',
  manaRegen: '/icons/statsicon/Mana_regeneration.svg',
  attackRange: '/icons/statsicon/Range.png',
  totalEffectiveHealth: '/icons/statsicon/Health.svg',
  physicalEffectiveHealth: '/icons/statsicon/Armor.png',
  magicalEffectiveHealth: '/icons/statsicon/Magic_resistance.png',
  armorDamageReductionPercent: '/icons/statsicon/Armor.png',
  magicDamageReductionPercent: '/icons/statsicon/Magic_resistance.png',
  cooldownReduction: '/icons/statsicon/Cooldown_reduction.png',
  goldValue: '/icons/statsicon/Gold.svg',
  goldCost: '/icons/statsicon/Gold.svg',
  goldEfficiency: '/icons/statsicon/Gold.svg',
  goldPer10: '/icons/statsicon/Gold.svg',
  lifeSteal: '/icons/statsicon/Life_steal.svg',
  spellVamp: '/icons/statsicon/Spell_vamp.png',
  omnivamp: '/icons/statsicon/Omnivamp.svg',
  tenacity: '/icons/statsicon/Tenacity.png',
  lethality: '/icons/statsicon/Armor_penetration.png',
  armorPenetration: '/icons/statsicon/Armor_penetration.png',
  magicPenetration: '/icons/statsicon/Magic_penetration.png',
  shield: '/icons/statsicon/Heal_and_shield_power.png',
  healShieldPower: '/icons/statsicon/Heal_and_shield_power.png',
}

const getStatIconSrc = (key: string): string | null => statIconByKey[key] ?? null

const getStatIconImageClass = (key: string): string => {
  const compactKeys = new Set([
    'tenacity',
    'shield',
    'healShieldPower',
    'abilityHaste',
    'cooldownReduction',
    'movementSpeed',
    'attackSpeed',
    'armor',
  ])
  return compactKeys.has(key) ? 'stat-inline-icon-image--compact' : ''
}

const getStatIconToneClass = (key: string): string => {
  const hpKeys = new Set(['health', 'healthRegen', 'totalEffectiveHealth'])
  const armorKeys = new Set(['armor', 'physicalEffectiveHealth', 'armorDamageReductionPercent'])
  const manaKeys = new Set(['mana', 'manaRegen'])
  const apKeys = new Set(['abilityPower'])
  const hasteKeys = new Set(['abilityHaste', 'cooldownReduction'])
  const critKeys = new Set(['critChance'])
  const vampKeys = new Set(['lifeSteal', 'spellVamp', 'omnivamp'])
  const adKeys = new Set(['attackDamage'])
  const asKeys = new Set(['attackSpeed'])
  const arpenKeys = new Set(['armorPenetration', 'lethality'])
  const shieldKeys = new Set(['shield', 'healShieldPower'])
  const tenacityKeys = new Set(['tenacity'])
  const mrKeys = new Set(['magicResist', 'magicalEffectiveHealth', 'magicDamageReductionPercent'])

  if (hpKeys.has(key)) return 'stat-inline-icon--hp'
  if (armorKeys.has(key)) return 'stat-inline-icon--armor'
  if (manaKeys.has(key)) return 'stat-inline-icon--mana'
  if (apKeys.has(key)) return 'stat-inline-icon--ap'
  if (hasteKeys.has(key)) return 'stat-inline-icon--haste'
  if (critKeys.has(key)) return 'stat-inline-icon--crit'
  if (vampKeys.has(key)) return 'stat-inline-icon--vamp'
  if (adKeys.has(key)) return 'stat-inline-icon--ad'
  if (asKeys.has(key)) return 'stat-inline-icon--as'
  if (arpenKeys.has(key)) return 'stat-inline-icon--arpen'
  if (shieldKeys.has(key)) return 'stat-inline-icon--shield'
  if (tenacityKeys.has(key)) return 'stat-inline-icon--tenacity'
  if (mrKeys.has(key)) return 'stat-inline-icon--mr'
  return 'stat-inline-icon--default'
}

const statFormulaKeys = new Set([
  'attackSpeed',
  'movementSpeed',
  'cooldownReduction',
  'totalEffectiveHealth',
  'physicalEffectiveHealth',
  'magicalEffectiveHealth',
  'armorDamageReductionPercent',
  'magicDamageReductionPercent',
])

const hasStatFormula = (key: string): boolean => statFormulaKeys.has(key)

function getStatFormatExtra(
  stat: {
    format: string
    itemPercentLethality?: number
    itemValueFlat?: number
    totalPercentLethality?: number
    totalValueFlat?: number
  },
  column: 'items' | 'total'
): number | undefined {
  if (stat.format === 'lethality') {
    return column === 'items' ? stat.itemPercentLethality : stat.totalPercentLethality
  }
  if (stat.format === 'penetration') {
    return column === 'items' ? stat.itemValueFlat : stat.totalValueFlat
  }
  return undefined
}

const getStatFormula = (key: string): string => {
  const map: Record<string, string> = {
    attackSpeed: 'stats.formulas.attackSpeed',
    movementSpeed: 'stats.formulas.movementSpeed',
    cooldownReduction: 'stats.formulas.abilityHaste',
    totalEffectiveHealth: 'stats.formulas.totalEffectiveHealth',
    physicalEffectiveHealth: 'stats.formulas.physicalEffectiveHealth',
    magicalEffectiveHealth: 'stats.formulas.magicalEffectiveHealth',
    armorDamageReductionPercent: 'stats.formulas.armorDamageReductionPercent',
    magicDamageReductionPercent: 'stats.formulas.magicDamageReductionPercent',
  }
  const i18nKey = map[key]
  return i18nKey ? t(i18nKey) : ''
}

const formatValue = (
  value: number | string,
  format: 'number' | 'decimal' | 'percent' | 'lethality' | 'penetration',
  formatExtra?: number
): string => {
  if (typeof value === 'string') {
    return value
  }
  if (format === 'lethality') {
    return formatLethality(value, (formatExtra ?? 0) / 100) || '0'
  }
  if (format === 'penetration') {
    return formatPenetrationPercentFlat(value as number, formatExtra ?? 0) || '0'
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

.stats-infobox {
  /* Align with items-manager panel background. */
  background: rgba(0, 0, 0, 0.15);
}

.stats-table-scroll {
  overflow-x: auto;
  overflow-y: visible;
  position: relative;
}

.stats-table-scroll table,
.stats-table-scroll th,
.stats-table-scroll td {
  overflow: visible;
}

.stats-gold-text {
  color: rgb(252 211 77 / 1);
}

.stat-category-separator {
  background-color: rgba(var(--color-primary-rgb), 0.1);
  border-top: 2px solid rgba(var(--color-primary-rgb), 0.3);
  border-bottom: 2px solid rgba(var(--color-primary-rgb), 0.3);
}

.stats-tabs {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.2rem;
  min-height: 36px;
  max-width: 100%;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.2rem;
}

.stats-tab {
  flex-shrink: 0;
  scroll-snap-align: start;
  white-space: nowrap;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: rgb(var(--rgb-text) / 0.75);
  min-height: 30px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  transition: all 0.2s ease;
}

.stats-tab:hover {
  background: rgb(var(--rgb-primary) / 0.16);
  color: rgb(var(--rgb-text));
}

.stats-tab--active {
  background: rgb(var(--rgb-primary) / 0.3);
  color: rgb(var(--rgb-text));
}

.stat-inline-icon {
  display: inline-flex;
  width: 1rem;
  height: 1rem;
  overflow: visible;
  align-items: center;
  justify-content: center;
  opacity: 1;
  border-radius: 9999px;
  transform: scale(2);
  transform-origin: center;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.24),
    0 0 8px rgb(255 255 255 / 0.14);
}

.stat-inline-icon-image {
  width: 0.85rem;
  height: 0.85rem;
  object-fit: contain;
  filter: saturate(1.25) brightness(1.08) contrast(1.08);
}

.stat-inline-icon-image--compact {
  width: calc(0.85rem - 2px);
  height: calc(0.85rem - 2px);
}

.stat-inline-icon--hp {
  background: rgb(22 255 117 / 0.52);
}

.stat-inline-icon--armor {
  background: rgb(191 107 28 / 0.54);
}

.stat-inline-icon--mana {
  background: rgb(66 220 255 / 0.52);
}

.stat-inline-icon--ap {
  background: rgb(182 77 255 / 0.52);
}

.stat-inline-icon--haste {
  background: rgb(255 255 255 / 0.5);
}

.stat-inline-icon--crit {
  background: rgb(255 44 44 / 0.56);
}

.stat-inline-icon--vamp {
  background: rgb(255 0 0 / 0.72);
}

.stat-inline-icon--ad {
  background: rgb(255 132 0 / 0.58);
}

.stat-inline-icon--as {
  background: rgb(255 231 43 / 0.62);
}

.stat-inline-icon--gold {
  background: rgb(255 196 25 / 0.62);
}

.stat-inline-icon--mr {
  background: rgb(232 224 255 / 0.62);
}

.stat-inline-icon--tenacity {
  background: rgb(88 28 135 / 0.72);
}

.stat-inline-icon--arpen {
  background: rgb(127 29 29 / 0.74);
}

.stat-inline-icon--shield {
  background: rgb(220 252 231 / 0.62);
}

.stat-inline-icon--default {
  background: rgb(148 163 184 / 0.38);
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
  z-index: 10;
}

.info-icon-wrapper:hover {
  z-index: 20000;
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
  display: block;
  padding: 12px 16px;
  background: rgb(0 0 0 / 0.92);
  border: 1px solid rgb(var(--rgb-primary) / 0.4);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  white-space: normal !important;
  word-break: break-word;
  overflow-wrap: anywhere;
  width: 320px;
  min-width: 280px;
  max-width: 90vw;
  z-index: 99999;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s ease-in-out,
    transform 0.2s ease-in-out,
    visibility 0s 0.2s;
  transform: translateX(-50%) translateY(8px);
  visibility: hidden;
  color: rgb(var(--rgb-text));
  color: #fff !important;
  font-size: 0.75rem;
  line-height: 1.5;
}

.info-tooltip-content {
  display: block;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: #fff;
}

.info-tooltip-disclaimer {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%);
  display: none;
  width: min(520px, 92vw);
  min-width: 320px;
  padding: 12px 16px;
  background: rgb(0 0 0 / 0.92);
  border: 1px solid rgb(var(--rgb-primary) / 0.4);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 99999;
}

.info-icon-wrapper:hover .info-tooltip-disclaimer {
  display: block;
}

.info-tooltip-disclaimer::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgb(var(--rgb-primary) / 0.4);
  margin-top: -1px;
}

.info-tooltip-disclaimer::before {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: rgb(0 0 0 / 0.92);
  margin-top: 0;
  z-index: 1;
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
  border-top-color: rgb(0 0 0 / 0.92);
  margin-top: 0;
  z-index: 1;
}
</style>
