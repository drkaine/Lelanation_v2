<template>
  <section class="item-compare ui-build-card-surface">
    <h3 class="item-compare__title">
      {{ a.name }} <span class="item-compare__vs">VS</span> {{ b.name }}
    </h3>

    <table class="item-compare__table">
      <thead>
        <tr>
          <th />
          <th>{{ a.name }}</th>
          <th>{{ b.name }}</th>
          <th>{{ t('itemShopPage.compare.diff') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>{{ t('itemShopPage.compare.price') }}</th>
          <td>{{ result.price.a }}g</td>
          <td>{{ result.price.b }}g</td>
          <td :class="diffClass(-result.price.diff)">{{ signed(result.price.diff) }}g</td>
        </tr>
        <tr>
          <th>{{ t('itemShopPage.compare.goldValue') }}</th>
          <td>{{ Math.round(result.goldValue.a) }}g</td>
          <td>{{ Math.round(result.goldValue.b) }}g</td>
          <td :class="diffClass(result.goldValue.diff)">
            {{ signed(Math.round(result.goldValue.diff)) }}g
          </td>
        </tr>
        <tr>
          <th>{{ t('itemShopPage.compare.efficiency') }}</th>
          <td>{{ percentOrDash(result.efficiency.a) }}</td>
          <td>{{ percentOrDash(result.efficiency.b) }}</td>
          <td :class="diffClass(result.efficiency.diff ?? 0)">
            {{
              result.efficiency.diff == null
                ? '—'
                : `${signed(Math.round(result.efficiency.diff))} pts`
            }}
          </td>
        </tr>
        <tr v-for="row in result.stats" :key="row.id">
          <th>{{ t(`itemShopPage.compare.stats.${row.id}`) }}</th>
          <td>{{ formatStat(row.a, row.percent) }}</td>
          <td>{{ formatStat(row.b, row.percent) }}</td>
          <td :class="diffClass(row.diff)">{{ signed(row.diff) }}{{ row.percent ? '%' : '' }}</td>
        </tr>
      </tbody>
    </table>

    <div class="item-compare__components">
      <h4 class="item-compare__subtitle">{{ t('itemShopPage.compare.components') }}</h4>
      <p v-if="!hasComponents" class="item-compare__empty">
        {{ t('itemShopPage.compare.noComponents') }}
      </p>
      <template v-for="group in componentGroups" :key="group.key">
        <div v-if="group.ids.length" class="item-compare__component-row">
          <span class="item-compare__component-label">{{ group.label }}</span>
          <img
            v-for="(id, index) in group.ids"
            :key="`${group.key}-${id}-${index}`"
            :src="componentImage(id)"
            :alt="itemName(id)"
            :title="itemName(id)"
            width="32"
            height="32"
            class="item-compare__component-icon"
          />
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Item } from '~/types/build'
import { compareItems } from '~/utils/itemCompare'
import { getItemShopImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'

const props = defineProps<{
  a: Item
  b: Item
  allItems: Item[]
}>()

const { t } = useI18n()
const { version } = useGameVersion()

const result = computed(() => compareItems(props.a, props.b))

const componentGroups = computed(() => [
  { key: 'shared', label: t('itemShopPage.compare.shared'), ids: result.value.components.shared },
  { key: 'onlyA', label: props.a.name, ids: result.value.components.onlyA },
  { key: 'onlyB', label: props.b.name, ids: result.value.components.onlyB },
])

const hasComponents = computed(() => componentGroups.value.some(group => group.ids.length > 0))

function findItem(id: string): Item | undefined {
  return props.allItems.find(item => item.id === id)
}

function itemName(id: string): string {
  return findItem(id)?.name ?? id
}

function componentImage(id: string): string {
  const item = findItem(id)
  return item ? getItemShopImageUrl(version.value, item) : ''
}

function signed(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

function formatStat(value: number, percent: boolean): string {
  if (Math.abs(value) < 0.01) return '—'
  return `${Math.round(value * 10) / 10}${percent ? '%' : ''}`
}

function percentOrDash(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : `${Math.round(value)}%`
}

/** Vert quand B fait mieux que A, rouge sinon. */
function diffClass(value: number): string {
  if (value > 0.01) return 'item-compare__diff--up'
  if (value < -0.01) return 'item-compare__diff--down'
  return ''
}
</script>

<style scoped>
.item-compare {
  width: 100%;
  border-radius: 0.75rem;
  padding: 0.75rem;
  font-size: 0.8rem;
}

.item-compare__title {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-accent, #c89b3c);
}

.item-compare__vs {
  margin: 0 0.35rem;
  color: rgb(var(--rgb-text) / 0.6);
}

.item-compare__table {
  width: 100%;
  border-collapse: collapse;
}

.item-compare__table th,
.item-compare__table td {
  padding: 0.25rem 0.35rem;
  border-bottom: 1px solid rgb(var(--rgb-accent) / 0.15);
  text-align: right;
}

.item-compare__table th:first-child {
  text-align: left;
  font-weight: 600;
  color: rgb(var(--rgb-text) / 0.8);
}

.item-compare__table thead th {
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(var(--rgb-text) / 0.7);
}

.item-compare__diff--up {
  color: rgb(74 222 128);
}

.item-compare__diff--down {
  color: rgb(248 113 113);
}

.item-compare__components {
  margin-top: 0.75rem;
}

.item-compare__subtitle {
  margin-bottom: 0.35rem;
  font-weight: 700;
  color: var(--color-accent, #c89b3c);
}

.item-compare__empty {
  color: rgb(var(--rgb-text) / 0.6);
}

.item-compare__component-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
}

.item-compare__component-label {
  min-width: 5rem;
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.item-compare__component-icon {
  border: 1px solid rgb(200 155 60 / 0.5);
  border-radius: 0.25rem;
}
</style>
