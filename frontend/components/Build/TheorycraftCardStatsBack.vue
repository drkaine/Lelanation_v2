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
      <div v-for="row in currentRows" :key="row.key" class="theorycraft-card-stats-back__row">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <div v-if="stats" class="theorycraft-card-stats-back__pager">
      <button
        type="button"
        class="theorycraft-card-stats-back__arrow"
        :disabled="pageIndex <= 0"
        @click="previousPage"
      >
        ‹
      </button>
      <div class="theorycraft-card-stats-back__dots">
        <button
          v-for="(page, index) in pages"
          :key="page.id"
          type="button"
          class="theorycraft-card-stats-back__dot"
          :class="{ 'theorycraft-card-stats-back__dot--active': index === pageIndex }"
          :aria-label="page.title"
          @click="pageIndex = index"
        />
      </div>
      <button
        type="button"
        class="theorycraft-card-stats-back__arrow"
        :disabled="pageIndex >= pages.length - 1"
        @click="nextPage"
      >
        ›
      </button>
    </div>

    <p
      v-if="stats && (activeItemCount > 0 || stackCount > 0)"
      class="theorycraft-card-stats-back__note"
    >
      {{ noteText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { calculateBuildGoldEfficiency, filterItemsForStats } from '@lelanation/builds-stats'
import type { CalculatedStats, Item } from '@lelanation/shared-types'
import {
  formatHealthPoolValue,
  formatResourcePoolValue,
  resolveChampionResourceKind,
  resolveResourceStatLabel,
} from '~/utils/theorycraftStats'

const props = defineProps<{
  stats: CalculatedStats | null
  level: number
  partype?: string | null
  activeItemCount?: number
  stackCount?: number
  items?: Item[] | null
}>()

const { t, locale } = useI18n()

function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0'
  const factor = 10 ** decimals
  return String(Math.round(value * factor) / factor)
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100, 1)}%`
}

const resourceLocale = computed<'fr' | 'en'>(() =>
  String(locale.value).startsWith('fr') ? 'fr' : 'en'
)
const pageIndex = ref(0)

function resourceLabel(): string {
  const kind = resolveChampionResourceKind(props.partype)
  if (kind === 'energy') return t('theorycraft.stats.energy')
  if (kind === 'mana' || kind === 'none') return t('theorycraft.stats.mana')
  return resolveResourceStatLabel(props.partype, resourceLocale.value)
}

const basicRows = computed(() => {
  const stats = props.stats
  if (!stats) return []

  return [
    {
      key: 'health',
      label: t('theorycraft.stats.health'),
      value: formatHealthPoolValue(stats.health),
    },
    {
      key: 'resource',
      label: resourceLabel(),
      value: formatResourcePoolValue(stats.mana, props.partype),
    },
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

const advancedRows = computed(() => {
  const stats = props.stats
  if (!stats) return []
  const physicalReduction = (100 * stats.armor) / (100 + stats.armor)
  const magicReduction = (100 * stats.magicResist) / (100 + stats.magicResist)
  const physicalEhp = stats.health * (1 + stats.armor / 100)
  const magicalEhp = stats.health * (1 + stats.magicResist / 100)
  const averageEhp = (physicalEhp + magicalEhp) / 2
  return [
    {
      key: 'physicalReduction',
      label: t('stats.labels.armorDamageReductionPercent'),
      value: `${formatNumber(physicalReduction, 1)}%`,
    },
    {
      key: 'magicReduction',
      label: t('stats.labels.magicDamageReductionPercent'),
      value: `${formatNumber(magicReduction, 1)}%`,
    },
    {
      key: 'physicalEhp',
      label: t('stats.labels.physicalEffectiveHealth'),
      value: formatNumber(physicalEhp),
    },
    {
      key: 'magicalEhp',
      label: t('stats.labels.magicalEffectiveHealth'),
      value: formatNumber(magicalEhp),
    },
    {
      key: 'averageEhp',
      label: t('stats.labels.totalEffectiveHealth'),
      value: formatNumber(averageEhp),
    },
    {
      key: 'armorPen',
      label: t('stats.labels.armorPenetration'),
      value: `${formatNumber(stats.armorPenetration * 100, 1)}% / ${formatNumber(stats.flatArmorPenetration, 1)}`,
    },
    {
      key: 'magicPen',
      label: t('stats.labels.magicPenetration'),
      value: `${formatNumber(stats.magicPenetration * 100, 1)}% / ${formatNumber(stats.flatMagicPenetration, 1)}`,
    },
    {
      key: 'lethality',
      label: t('stats.labels.lethality'),
      value: `${formatNumber(stats.lethality, 1)} (${formatNumber(stats.percentLethality * 100, 1)}%)`,
    },
    {
      key: 'lifeSteal',
      label: t('stats.labels.lifeSteal'),
      value: `${formatNumber(stats.lifeSteal * 100, 1)}%`,
    },
    {
      key: 'spellVamp',
      label: t('stats.labels.spellVamp'),
      value: `${formatNumber(stats.spellVamp * 100, 1)}%`,
    },
    {
      key: 'omnivamp',
      label: t('stats.labels.omnivamp'),
      value: `${formatNumber(stats.omnivamp * 100, 1)}%`,
    },
    {
      key: 'tenacity',
      label: t('stats.labels.tenacity'),
      value: `${formatNumber(stats.tenacity * 100, 1)}%`,
    },
    { key: 'shield', label: t('stats.labels.shield'), value: formatNumber(stats.shield, 1) },
    {
      key: 'healShieldPower',
      label: t('stats.labels.healShieldPower'),
      value: `${formatNumber(stats.healShieldPower * 100, 1)}%`,
    },
    {
      key: 'healthRegen',
      label: t('stats.labels.healthRegen'),
      value: formatNumber(stats.healthRegen, 2),
    },
    {
      key: 'manaRegen',
      label: t('stats.labels.manaRegen'),
      value: formatNumber(stats.manaRegen, 2),
    },
    {
      key: 'attackRange',
      label: t('stats.labels.attackRange'),
      value: formatNumber(stats.attackRange),
    },
    {
      key: 'goldPer10',
      label: t('stats.labels.goldGeneration'),
      value: formatNumber(stats.goldPer10, 1),
    },
    ...((stats.damageReduction ?? 0) > 0
      ? [
          {
            key: 'damageReduction',
            label: t('theorycraft.stats.damageReduction'),
            value: formatPercent(stats.damageReduction!),
          },
        ]
      : []),
  ]
})

const economicRows = computed(() => {
  const filtered = filterItemsForStats(props.items ?? [])
  const eco = calculateBuildGoldEfficiency(filtered)
  return [
    {
      key: 'goldValue',
      label: t('stats.labels.goldValue'),
      value: formatNumber(eco.totalGoldValue),
    },
    { key: 'goldCost', label: t('stats.labels.goldCost'), value: formatNumber(eco.totalGoldCost) },
    {
      key: 'goldEfficiency',
      label: t('stats.labels.goldEfficiency'),
      value: `${formatNumber(eco.goldEfficiency, 1)}%`,
    },
  ]
})

const pages = computed(() => [
  { id: 'basic', title: t('stats.categories.basic'), rows: basicRows.value },
  { id: 'advanced', title: t('stats.categories.advanced'), rows: advancedRows.value },
  { id: 'economic', title: t('stats.categories.economic'), rows: economicRows.value },
])

const currentRows = computed(() => pages.value[pageIndex.value]?.rows ?? [])

function previousPage() {
  if (pageIndex.value > 0) pageIndex.value -= 1
}
function nextPage() {
  if (pageIndex.value < pages.value.length - 1) pageIndex.value += 1
}

watch(
  () => props.stats,
  () => {
    pageIndex.value = 0
  }
)

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

.theorycraft-card-stats-back__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.theorycraft-card-stats-back__arrow {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.28);
  color: rgb(255 255 255 / 0.82);
  line-height: 1;
}

.theorycraft-card-stats-back__arrow:disabled {
  opacity: 0.35;
}

.theorycraft-card-stats-back__dots {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.theorycraft-card-stats-back__dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.35);
}

.theorycraft-card-stats-back__dot--active {
  background: rgb(252 211 77 / 0.95);
}
</style>
