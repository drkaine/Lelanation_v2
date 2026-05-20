<template>
  <div class="theorycraft-card-stats-back">
    <h3 class="theorycraft-card-stats-back__title">
      {{ t('theorycraft.stats.title') }}
      <span class="theorycraft-card-stats-back__level">
        {{ t('theorycraft.spells.championLevel') }} {{ level }}
      </span>
    </h3>

    <p v-if="!stats" class="theorycraft-card-stats-back__empty">
      {{ t('theorycraft.stats.empty') }}
    </p>

    <dl v-else class="theorycraft-card-stats-back__grid">
      <div v-for="row in rows" :key="row.key" class="theorycraft-card-stats-back__row">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <p
      v-if="stats && (activeItemCount > 0 || stackCount > 0)"
      class="theorycraft-card-stats-back__note"
    >
      {{ noteText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CalculatedStats } from '@lelanation/shared-types'

const props = defineProps<{
  stats: CalculatedStats | null
  level: number
  activeItemCount?: number
  stackCount?: number
}>()

const { t } = useI18n()

function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0'
  const factor = 10 ** decimals
  return String(Math.round(value * factor) / factor)
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100, 1)}%`
}

const rows = computed(() => {
  const stats = props.stats
  if (!stats) return []

  return [
    { key: 'health', label: t('theorycraft.stats.health'), value: formatNumber(stats.health) },
    { key: 'mana', label: t('theorycraft.stats.mana'), value: formatNumber(stats.mana) },
    {
      key: 'attackDamage',
      label: t('theorycraft.stats.attackDamage'),
      value: formatNumber(stats.attackDamage),
    },
    {
      key: 'abilityPower',
      label: t('theorycraft.stats.abilityPower'),
      value: formatNumber(stats.abilityPower),
    },
    { key: 'armor', label: t('theorycraft.stats.armor'), value: formatNumber(stats.armor) },
    {
      key: 'magicResist',
      label: t('theorycraft.stats.magicResist'),
      value: formatNumber(stats.magicResist),
    },
    {
      key: 'attackSpeed',
      label: t('theorycraft.stats.attackSpeed'),
      value: formatNumber(stats.attackSpeed, 2),
    },
    {
      key: 'critChance',
      label: t('theorycraft.stats.critChance'),
      value: formatPercent(stats.critChance),
    },
    {
      key: 'critDamage',
      label: t('theorycraft.stats.critDamage'),
      value: formatPercent(stats.critDamage),
    },
    {
      key: 'movementSpeed',
      label: t('theorycraft.stats.movementSpeed'),
      value: formatNumber(stats.movementSpeed),
    },
    {
      key: 'abilityHaste',
      label: t('theorycraft.stats.abilityHaste'),
      value: formatPercent(stats.cooldownReduction ?? 0),
    },
  ]
})

const noteText = computed(() => {
  const parts: string[] = []
  if ((props.activeItemCount ?? 0) > 0) {
    parts.push(t('theorycraft.stats.activeItemsNote', { count: props.activeItemCount ?? 0 }))
  }
  if ((props.stackCount ?? 0) > 0) {
    parts.push(t('theorycraft.stats.stacksNote', { count: props.stackCount ?? 0 }))
  }
  return parts.join(' · ')
})
</script>

<style scoped>
.theorycraft-card-stats-back {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  height: 100%;
  padding: 0.75rem;
}

.theorycraft-card-stats-back__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-gold-300, #c89b3c);
}

.theorycraft-card-stats-back__level {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: rgb(255 255 255 / 0.65);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.theorycraft-card-stats-back__empty {
  margin: 0;
  font-size: 0.8rem;
  color: rgb(255 255 255 / 0.6);
}

.theorycraft-card-stats-back__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem 0.75rem;
  margin: 0;
}

.theorycraft-card-stats-back__row {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.theorycraft-card-stats-back__row dt {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(252 211 77 / 0.9);
}

.theorycraft-card-stats-back__row dd {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: rgb(255 255 255 / 0.95);
}

.theorycraft-card-stats-back__note {
  margin: auto 0 0;
  font-size: 0.65rem;
  line-height: 1.35;
  color: rgb(255 255 255 / 0.55);
}
</style>
