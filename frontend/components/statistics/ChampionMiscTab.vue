<template>
  <div class="champion-misc-tab">
    <div v-if="pending" class="text-sm text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>
    <div v-else-if="!hasData" class="statistics-empty-panel p-4">
      {{ t('statisticsPage.championMiscEmpty') }}
    </div>
    <template v-else>
      <h2 class="hd-title">{{ t('statisticsPage.healDamageTitle') }}</h2>
      <div class="hd-grid">
        <section v-if="heal.length" class="hd-card">
          <h3>{{ t('statisticsPage.championMiscGroup_healing') }}</h3>
          <ul class="hd-bars">
            <li v-for="m in heal" :key="m.key">
              <span>{{ t(`statisticsPage.championMisc_healing_${m.key}`) }}</span>
              <span class="hd-track"><span :style="{ width: `${m.pct}%` }" /></span>
              <b>{{ fmt(m.avgPerGame) }}</b>
            </li>
          </ul>
        </section>
        <section v-if="damage.total > 0" class="hd-card">
          <h3>{{ t('statisticsPage.championMiscDamageTotal', { total: fmt(damage.total) }) }}</h3>
          <div class="hd-stack">
            <span
              v-for="p in damage.parts"
              :key="p.key"
              :class="`hd-seg-${p.key}`"
              :style="{ width: `${p.pct}%` }"
            />
          </div>
          <p class="hd-legend">
            <span v-for="p in damage.parts" :key="p.key">
              {{ t(`statisticsPage.championMisc_damageTypes_${p.key}`) }}
              <b>{{ fmt(p.value) }}</b> · {{ Math.round(p.pct) }} %
            </span>
          </p>
        </section>
        <section v-if="multikills.length" class="hd-card">
          <h3>{{ t('statisticsPage.championMiscGroup_multikills') }}</h3>
          <ul class="hd-bars">
            <li v-for="m in multikills" :key="m.key">
              <span>{{ t(`statisticsPage.championMisc_multikills_${m.key}`) }}</span>
              <span class="hd-track"><span :style="{ width: `${m.pct}%` }" /></span>
              <b>{{ formatMetric(m) }}</b>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { damageSplit, healingBars } from '~/utils/statistics/healDamageView'

export type ChampionMiscMetric = { key: string; avgPerGame: number }
export type ChampionMiscMetricGroup = { key: string; metrics: ChampionMiscMetric[] }
export type ChampionMiscSummary = {
  games?: number
  groups?: ChampionMiscMetricGroup[]
}

const props = defineProps<{
  data: ChampionMiscSummary | null
  pending?: boolean
}>()

const { t } = useI18n()

const gamesCount = computed(() => Number(props.data?.games ?? 0))

const displayGroups = computed(() => props.data?.groups ?? [])

const visibleGroups = computed(() =>
  displayGroups.value
    .map(g => ({
      ...g,
      metrics: g.metrics.filter(m => Number(m.avgPerGame) > 0),
    }))
    .filter(g => g.metrics.length > 0)
)

const hasData = computed(() => gamesCount.value > 0 && visibleGroups.value.length > 0)

const MULTIKILL_KEYS = new Set(['double', 'triple', 'quadra', 'penta', 'unreal'])

const groupMetrics = (key: string) => visibleGroups.value.find(g => g.key === key)?.metrics ?? []
const heal = computed(() => healingBars(groupMetrics('healing')))
const damage = computed(() => damageSplit(groupMetrics('damageTypes')))
const multikills = computed(() => healingBars(groupMetrics('multikills')))

function fmt(v: number): string {
  return Math.round(v)
    .toLocaleString('fr-FR')
    .replace(/[\u202F\u00A0]/g, ' ')
}

function formatMetric(metric: ChampionMiscMetric): string {
  const v = Number(metric.avgPerGame)
  if (!Number.isFinite(v)) return '—'
  if (MULTIKILL_KEYS.has(metric.key)) {
    return v < 0.01 ? '< 0.01' : v.toFixed(2)
  }
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
</script>

<style scoped>
.hd-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.hd-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.hd-card {
  padding: 20px;
  border: 1px solid #463714;
  border-radius: 10px;
  background: #0a1428;
}
.hd-card h3 {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: #f0e6d2;
}
.hd-bars {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hd-bars li {
  display: grid;
  grid-template-columns: 200px 1fr 60px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #f0e6d2;
}
.hd-bars b {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.hd-track {
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.hd-track > span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: #0ac8b9;
}
.hd-stack {
  display: flex;
  height: 14px;
  gap: 2px;
  border-radius: 7px;
  overflow: hidden;
  background: #1e2328;
}
.hd-seg-magicDone {
  background: #0397ab;
}
.hd-seg-physicalDone {
  background: #e2665a;
}
.hd-seg-trueDone {
  background: #f0e6d2;
}
.hd-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin: 12px 0 0;
  font-size: 13px;
  color: #f0e6d2;
}
@media (max-width: 1023px) {
  .hd-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .hd-bars li {
    grid-template-columns: minmax(0, 1fr) 80px 56px;
  }
}
</style>
