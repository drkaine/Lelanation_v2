<script setup lang="ts">
import { computed } from 'vue'
import {
  emptyRegionCompare,
  extremeRegions,
  formatSpread,
  regionLabel,
  type RegionMetric,
  type RegionSpread,
} from '~/utils/statistics/regionCompare'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const data = computed(() => p.regionCompareData ?? emptyRegionCompare())
const regionNames = computed(() => data.value.regions.map(r => r.region))

const metrics: { key: RegionMetric; label: string; unit: 'pct' | 'num' }[] = [
  { key: 'matches', label: 'statisticsPage.regionsMatches', unit: 'num' },
  { key: 'surrenderRate', label: 'statisticsPage.regionsSurrender', unit: 'pct' },
  { key: 'earlySurrenderRate', label: 'statisticsPage.regionsEarlySurrender', unit: 'pct' },
  { key: 'afkRate', label: 'statisticsPage.regionsAfk', unit: 'pct' },
  { key: 'avgDurationMin', label: 'statisticsPage.regionsDuration', unit: 'num' },
  { key: 'avgKills', label: 'statisticsPage.regionsKills', unit: 'num' },
]
const extremes = computed(() =>
  Object.fromEntries(metrics.map(m => [m.key, extremeRegions(data.value.regions, m.key)]))
)
function cellClass(metric: RegionMetric, region: string): string {
  if (metric === 'matches') return ''
  const e = extremes.value[metric]
  if (e?.high === region) return 'font-semibold text-red-400'
  if (e?.low === region) return 'font-semibold text-emerald-400'
  return ''
}
function formatMetric(value: number, unit: 'pct' | 'num'): string {
  return unit === 'pct'
    ? `${value.toFixed(2)}%`
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const spreadSections = computed<{ key: string; title: string; rows: RegionSpread[] }[]>(() => [
  { key: 'pick', title: 'statisticsPage.regionsSpreadPick', rows: data.value.spreads.pickRate },
  { key: 'ban', title: 'statisticsPage.regionsSpreadBan', rows: data.value.spreads.banRate },
  { key: 'wr', title: 'statisticsPage.regionsSpreadWinrate', rows: data.value.spreads.winRate },
])
const topKinds = [
  { key: 'picked', title: 'statisticsPage.regionsTopPicked' },
  { key: 'banned', title: 'statisticsPage.regionsTopBanned' },
  { key: 'winrate', title: 'statisticsPage.regionsTopWinrate' },
] as const

function championSrc(championId: number): string | null {
  const champ = p.championByKey(championId)
  if (!p.gameVersion || !champ) return null
  return p.getChampionImageUrl(p.gameVersion, champ.image.full)
}
function championName(championId: number): string {
  return p.championByKey(championId)?.name ?? String(championId)
}
</script>

<template>
  <div class="statistics-region-compare-tab space-y-4">
    <div v-if="p.regionComparePending" class="text-sm text-text/70">
      {{ p.t('statisticsPage.regionsLoading') }}
    </div>
    <p v-else-if="data.regions.length === 0" class="text-sm text-text/70">
      {{ p.t('statisticsPage.regionsEmpty') }}
    </p>
    <template v-else>
      <section class="ui-build-card-surface rounded-xl p-3">
        <h3 class="text-sm font-semibold text-text-accent">
          {{ p.t('statisticsPage.regionsSummaryTitle') }}
        </h3>
        <p class="mb-2 text-xs text-text/60">{{ p.t('statisticsPage.regionsSummaryHint') }}</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-text/60">
              <tr>
                <th class="text-left font-normal" />
                <th v-for="r in regionNames" :key="r" class="text-right font-normal">
                  {{ regionLabel(r) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in metrics" :key="m.key" class="border-t border-white/5">
                <td class="py-1">{{ p.t(m.label) }}</td>
                <td
                  v-for="r in data.regions"
                  :key="r.region"
                  class="text-right tabular-nums"
                  :class="cellClass(m.key, r.region)"
                >
                  {{ formatMetric(r[m.key], m.unit) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-3">
        <section
          v-for="s in spreadSections"
          :key="s.key"
          class="ui-build-card-surface rounded-xl p-3"
        >
          <h3 class="text-sm font-semibold text-text-accent">{{ p.t(s.title) }}</h3>
          <p class="mb-2 text-xs text-text/60">{{ p.t('statisticsPage.regionsSpreadHint') }}</p>
          <p v-if="s.rows.length === 0" class="text-sm text-text/70">
            {{ p.t('statisticsPage.regionsEmpty') }}
          </p>
          <ul v-else class="space-y-1 text-sm">
            <li v-for="row in s.rows" :key="row.championId" class="flex items-center gap-2">
              <img
                v-if="championSrc(row.championId)"
                :src="championSrc(row.championId) ?? undefined"
                :alt="championName(row.championId)"
                class="h-6 w-6 rounded"
                loading="lazy"
              />
              <span class="flex-1 truncate">{{ championName(row.championId) }}</span>
              <span class="text-xs text-text/60">
                {{ regionLabel(row.high) }} {{ row.byRegion[row.high]?.toFixed(2) }}% ·
                {{ regionLabel(row.low) }} {{ row.byRegion[row.low]?.toFixed(2) }}%
              </span>
              <span class="w-20 text-right font-semibold tabular-nums">
                {{ formatSpread(row.spread) }}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section class="ui-build-card-surface rounded-xl p-3">
        <h3 class="mb-2 text-sm font-semibold text-text-accent">
          {{ p.t('statisticsPage.regionsTopTitle') }}
        </h3>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="top in data.topByRegion" :key="top.region" class="space-y-2">
            <h4 class="text-sm font-semibold">{{ regionLabel(top.region) }}</h4>
            <div v-for="k in topKinds" :key="k.key">
              <div class="text-xs text-text/60">{{ p.t(k.title) }}</div>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="c in top[k.key].slice(0, 5)"
                  :key="c.championId"
                  class="flex items-center gap-1 rounded bg-white/5 px-1 py-0.5 text-xs"
                  :title="championName(c.championId)"
                >
                  <img
                    v-if="championSrc(c.championId)"
                    :src="championSrc(c.championId) ?? undefined"
                    :alt="championName(c.championId)"
                    class="h-5 w-5 rounded"
                    loading="lazy"
                  />
                  {{ c.rate.toFixed(1) }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
