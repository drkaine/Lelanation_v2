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

      <!-- Debug info (temporaire) -->
      <div
        v-if="!baseStatsAtLevel || !totalStats"
        class="rounded border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600"
      >
        <p>Données manquantes pour le calcul des stats:</p>
        <ul class="mt-1 list-inside list-disc">
          <li>Champion: {{ champion ? '✓' : '✗' }}</li>
          <li>Base stats: {{ baseStatsAtLevel ? '✓' : '✗' }}</li>
          <li>Total stats: {{ totalStats ? '✓' : '✗' }}</li>
          <li>Items: {{ items.length }}</li>
          <li>Runes: {{ runes ? '✓' : '✗' }}</li>
          <li>Shards: {{ shards ? '✓' : '✗' }}</li>
        </ul>
      </div>

      <!-- Stats Table -->
      <div v-if="statsList.length > 0" class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-primary/30">
              <th class="px-4 py-2 text-left text-sm font-semibold text-text">
                {{ t('stats.statColumn') }}
              </th>
              <th class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ t('stats.base') }}
              </th>
              <th class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ t('stats.itemsColumn') }}
              </th>
              <th class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ t('stats.total') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="stat in statsList"
              :key="stat.key"
              class="border-b border-primary/20 hover:bg-primary/5"
            >
              <td class="px-4 py-2 text-sm text-text">{{ stat.label }}</td>
              <td class="px-4 py-2 text-center text-sm text-text/80">
                {{ formatValue(stat.baseValue, stat.format) }}
              </td>
              <td class="px-4 py-2 text-center text-sm text-text/80">
                {{
                  typeof stat.itemValue === 'string'
                    ? stat.itemValue
                    : formatValue(stat.itemValue, stat.format)
                }}
              </td>
              <td class="px-4 py-2 text-center text-sm font-semibold text-text">
                {{ formatValue(stat.totalValue, stat.format) }}
              </td>
            </tr>
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
import type { Build } from '~/types/build'

const props = defineProps<{
  build?: Build | null
}>()

const { t } = useI18n()
const buildStore = useBuildStore()
const selectedLevel = ref(18)

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

// Calculate item stats + runes + shards
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

  // Items
  for (const item of items.value) {
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
    // Lethality
    totals.lethality += (item.stats as any).FlatLethality || 0
    // Omnivamp
    totals.omnivamp +=
      ((item.stats as any).FlatOmnivamp || 0) + ((item.stats as any).PercentOmnivamp || 0)
    // Shield
    totals.shield +=
      ((item.stats as any).FlatShield || 0) + ((item.stats as any).PercentShield || 0)
    // Attack Range
    totals.attackRange += (item.stats as any).FlatAttackRangeMod || 0
  }

  // Shards (ajoutés aux items pour l'affichage)
  if (shards.value) {
    // Slot 1: Adaptive Force (5008), Attack Speed (5005), Ability Haste (5007)
    if (shards.value.slot1 === 5008) {
      totals.attackDamage += 9
    } else if (shards.value.slot1 === 5005) {
      totals.attackSpeed += 0.1
    } else if (shards.value.slot1 === 5007) {
      totals.cooldownReduction += 8
    }

    // Slot 2: Adaptive Force (5008), Armor (5002), Magic Resist (5003)
    if (shards.value.slot2 === 5008) {
      totals.attackDamage += 9
    } else if (shards.value.slot2 === 5002) {
      totals.armor += 6
    } else if (shards.value.slot2 === 5003) {
      totals.magicResist += 8
    }

    // Slot 3: Health (5001), Armor (5002), Magic Resist (5003)
    if (shards.value.slot3 === 5001) {
      totals.health += 15
    } else if (shards.value.slot3 === 5002) {
      totals.armor += 6
    } else if (shards.value.slot3 === 5003) {
      totals.magicResist += 8
    }
  }

  return totals
})

// Calculate total stats
const totalStats = computed(() => {
  if (!champion.value) return null
  return calculateStats(
    champion.value as any,
    items.value,
    runes.value,
    shards.value,
    selectedLevel.value
  )
})

// Stats list with base, items, and total values
const statsList = computed(() => {
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
      totalValue: total.health,
      format: 'number' as const,
    },
    {
      key: 'mana',
      label: t('stats.labels.mana'),
      baseValue: base.mp,
      itemValue: items.mana || 0,
      totalValue: total.mana,
      format: 'number' as const,
    },
    {
      key: 'attackDamage',
      label: t('stats.labels.attackDamage'),
      baseValue: base.attackdamage,
      itemValue: items.attackDamage || 0,
      totalValue: total.attackDamage,
      format: 'number' as const,
    },
    {
      key: 'abilityPower',
      label: t('stats.labels.abilityPower'),
      baseValue: 0,
      itemValue: items.abilityPower || 0,
      totalValue: total.abilityPower,
      format: 'number' as const,
    },
    {
      key: 'armor',
      label: t('stats.labels.armor'),
      baseValue: base.armor,
      itemValue: items.armor || 0,
      totalValue: total.armor,
      format: 'number' as const,
    },
    {
      key: 'magicResist',
      label: t('stats.labels.magicResist'),
      baseValue: base.spellblock,
      itemValue: items.magicResist || 0,
      totalValue: total.magicResist,
      format: 'number' as const,
    },
    {
      key: 'attackSpeed',
      label: t('stats.labels.attackSpeed'),
      baseValue: base.attackspeed,
      itemValue: ((items.attackSpeed || 0) * 100).toFixed(1) + '%',
      totalValue: total.attackSpeed,
      format: 'decimal' as const,
    },
    {
      key: 'critChance',
      label: t('stats.labels.critChance'),
      baseValue: 0,
      itemValue: items.critChance || 0,
      totalValue: total.critChance * 100,
      format: 'percent' as const,
    },
    {
      key: 'critDamage',
      label: t('stats.labels.critDamage'),
      baseValue: 175,
      itemValue: items.critDamage || 0,
      totalValue: total.critDamage * 100,
      format: 'percent' as const,
    },
    {
      key: 'lifeSteal',
      label: t('stats.labels.lifeSteal'),
      baseValue: 0,
      itemValue: items.lifeSteal || 0,
      totalValue: total.lifeSteal * 100,
      format: 'percent' as const,
    },
    {
      key: 'spellVamp',
      label: t('stats.labels.spellVamp'),
      baseValue: 0,
      itemValue: items.spellVamp || 0,
      totalValue: total.spellVamp * 100,
      format: 'percent' as const,
    },
    {
      key: 'cooldownReduction',
      label: t('stats.labels.cooldownReduction'),
      baseValue: 0,
      itemValue: items.cooldownReduction || 0,
      totalValue: total.cooldownReduction * 100,
      format: 'percent' as const,
    },
    {
      key: 'movementSpeed',
      label: t('stats.labels.movementSpeed'),
      baseValue: base.movespeed,
      itemValue: items.movementSpeed || 0,
      totalValue: total.movementSpeed,
      format: 'number' as const,
    },
    {
      key: 'healthRegen',
      label: t('stats.labels.healthRegen'),
      baseValue: base.hpregen,
      itemValue: items.healthRegen || 0,
      totalValue: total.healthRegen,
      format: 'decimal' as const,
    },
    {
      key: 'manaRegen',
      label: t('stats.labels.manaRegen'),
      baseValue: base.mpregen,
      itemValue: items.manaRegen || 0,
      totalValue: total.manaRegen,
      format: 'decimal' as const,
    },
    {
      key: 'armorPenetration',
      label: t('stats.labels.armorPenetration'),
      baseValue: 0,
      itemValue: items.armorPenetration || 0,
      totalValue: total.armorPenetration * 100,
      format: 'percent' as const,
    },
    {
      key: 'magicPenetration',
      label: t('stats.labels.magicPenetration'),
      baseValue: 0,
      itemValue: items.magicPenetration || 0,
      totalValue: total.magicPenetration * 100,
      format: 'percent' as const,
    },
    {
      key: 'tenacity',
      label: t('stats.labels.tenacity'),
      baseValue: 0,
      itemValue: items.tenacity || 0,
      totalValue: total.tenacity * 100,
      format: 'percent' as const,
    },
    {
      key: 'lethality',
      label: t('stats.labels.lethality'),
      baseValue: 0,
      itemValue: items.lethality || 0,
      totalValue: total.lethality,
      format: 'number' as const,
    },
    {
      key: 'omnivamp',
      label: t('stats.labels.omnivamp'),
      baseValue: 0,
      itemValue: items.omnivamp || 0,
      totalValue: total.omnivamp * 100,
      format: 'percent' as const,
    },
    {
      key: 'shield',
      label: t('stats.labels.shield'),
      baseValue: 0,
      itemValue: items.shield || 0,
      totalValue: total.shield,
      format: 'number' as const,
    },
    {
      key: 'attackRange',
      label: t('stats.labels.attackRange'),
      baseValue: (base as any).attackrange || champion.value?.stats.attackrange || 0,
      itemValue: items.attackRange || 0,
      totalValue: total.attackRange,
      format: 'number' as const,
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
</style>
