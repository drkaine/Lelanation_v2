<script setup lang="ts">
import { computed } from 'vue'
import { formatSpread, regionLabel, type RegionSpread } from '~/utils/statistics/regionCompare'
import { emptyOtpCompare, type OtpGroup, type OtpGroupSummary } from '~/utils/statistics/otpCompare'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

const data = computed(() => p.otpCompareData ?? emptyOtpCompare())

type GroupMetric = Exclude<keyof OtpGroupSummary, 'group'>
const metrics: { key: GroupMetric; label: string; unit: 'pct' | 'num' }[] = [
  { key: 'games', label: 'statisticsPage.otpCompareGames', unit: 'num' },
  { key: 'winRate', label: 'statisticsPage.otpCompareWinrate', unit: 'pct' },
  { key: 'kda', label: 'statisticsPage.otpCompareKda', unit: 'num' },
  { key: 'avgKills', label: 'statisticsPage.otpCompareKills', unit: 'num' },
  { key: 'afkRate', label: 'statisticsPage.otpCompareAfk', unit: 'pct' },
  { key: 'champions', label: 'statisticsPage.otpCompareChampions', unit: 'num' },
]
function groupLabel(g: string): string {
  return p.t(
    g === 'otp' ? 'statisticsPage.otpCompareGroupOtp' : 'statisticsPage.otpCompareGroupOthers'
  )
}
function formatMetric(value: number, unit: 'pct' | 'num'): string {
  return unit === 'pct'
    ? `${value.toFixed(2)}%`
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const spreadSections = computed<{ key: string; title: string; rows: RegionSpread[] }[]>(() => [
  { key: 'pick', title: 'statisticsPage.otpCompareSpreadPick', rows: data.value.spreads.pickRate },
  { key: 'wr', title: 'statisticsPage.otpCompareSpreadWinrate', rows: data.value.spreads.winRate },
])
const topKinds = [
  { key: 'picked', title: 'statisticsPage.otpCompareTopPicked' },
  { key: 'winrate', title: 'statisticsPage.otpCompareTopWinrate' },
] as const
const groups: OtpGroup[] = ['otp', 'others']

const population = computed(() => data.value.population)
function tierLabel(tier: string): string {
  return tier === 'UNRANKED'
    ? p.t('statisticsPage.otpComparePopulationUnranked')
    : tier.charAt(0) + tier.slice(1).toLowerCase()
}
function cellPlayers(region: string, tier: string): number {
  return population.value.cells.find(c => c.region === region && c.tier === tier)?.players ?? 0
}

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
  <div class="statistics-otp-compare-tab space-y-4">
    <div v-if="p.otpComparePending" class="text-sm text-text/70">
      {{ p.t('statisticsPage.otpCompareLoading') }}
    </div>
    <p v-else-if="data.groups.length === 0" class="text-sm text-text/70">
      {{ p.t('statisticsPage.otpCompareEmpty') }}
    </p>
    <template v-else>
      <section v-if="population.total > 0" class="ui-build-card-surface rounded-xl p-3">
        <h3 class="text-sm font-semibold text-text-accent">
          {{ p.t('statisticsPage.otpComparePopulationTitle') }}
        </h3>
        <p class="mb-2 text-xs text-text/60">
          {{ p.t('statisticsPage.otpComparePopulationHint') }}
        </p>
        <p class="mb-3 text-sm">
          {{ p.t('statisticsPage.otpComparePopulationTotal') }} :
          <span class="font-semibold">{{ population.total.toLocaleString() }}</span>
        </p>
        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="col in [
              {
                key: 'region',
                title: 'statisticsPage.otpComparePopulationByRegion',
                rows: population.byRegion.map(r => ({
                  id: r.region,
                  label: regionLabel(r.region),
                  players: r.players,
                  pct: r.pct,
                })),
              },
              {
                key: 'tier',
                title: 'statisticsPage.otpComparePopulationByTier',
                rows: population.byTier.map(r => ({
                  id: r.tier,
                  label: tierLabel(r.tier),
                  players: r.players,
                  pct: r.pct,
                })),
              },
            ]"
            :key="col.key"
          >
            <h4 class="mb-1 text-xs font-semibold text-text/80">{{ p.t(col.title) }}</h4>
            <ul class="space-y-1 text-sm">
              <li v-for="row in col.rows" :key="row.id">
                <div class="flex justify-between gap-2">
                  <span>{{ row.label }}</span>
                  <span class="tabular-nums text-text/70">
                    {{ row.players.toLocaleString() }} · {{ row.pct.toFixed(1) }}%
                  </span>
                </div>
                <div class="h-1.5 rounded bg-white/5">
                  <div class="h-1.5 rounded bg-accent" :style="{ width: `${row.pct}%` }" />
                </div>
              </li>
            </ul>
          </div>
        </div>
        <div v-if="population.byRegion.length > 1" class="mt-4 overflow-x-auto">
          <table class="w-full text-xs">
            <thead class="text-text/60">
              <tr>
                <th class="text-left font-normal" />
                <th v-for="t in population.byTier" :key="t.tier" class="text-right font-normal">
                  {{ tierLabel(t.tier) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in population.byRegion" :key="r.region" class="border-t border-white/5">
                <td class="py-1">{{ regionLabel(r.region) }}</td>
                <td v-for="t in population.byTier" :key="t.tier" class="text-right tabular-nums">
                  {{ cellPlayers(r.region, t.tier) || '–' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="ui-build-card-surface rounded-xl p-3">
        <h3 class="text-sm font-semibold text-text-accent">
          {{ p.t('statisticsPage.otpCompareSummaryTitle') }}
        </h3>
        <p class="mb-2 text-xs text-text/60">{{ p.t('statisticsPage.otpCompareSummaryHint') }}</p>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs text-text/60">
              <tr>
                <th class="text-left font-normal" />
                <th v-for="g in data.groups" :key="g.group" class="text-right font-normal">
                  {{ groupLabel(g.group) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in metrics" :key="m.key" class="border-t border-white/5">
                <td class="py-1">{{ p.t(m.label) }}</td>
                <td v-for="g in data.groups" :key="g.group" class="text-right tabular-nums">
                  {{ formatMetric(g[m.key], m.unit) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section
          v-for="s in spreadSections"
          :key="s.key"
          class="ui-build-card-surface rounded-xl p-3"
        >
          <h3 class="text-sm font-semibold text-text-accent">{{ p.t(s.title) }}</h3>
          <p class="mb-2 text-xs text-text/60">{{ p.t('statisticsPage.otpCompareSpreadHint') }}</p>
          <p v-if="s.rows.length === 0" class="text-sm text-text/70">
            {{ p.t('statisticsPage.otpCompareEmpty') }}
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
                {{ groupLabel(row.high) }} {{ row.byRegion[row.high]?.toFixed(2) }}% ·
                {{ groupLabel(row.low) }} {{ row.byRegion[row.low]?.toFixed(2) }}%
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
          {{ p.t('statisticsPage.otpCompareTopTitle') }}
        </h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div v-for="g in groups" :key="g" class="space-y-2">
            <h4 class="text-sm font-semibold">{{ groupLabel(g) }}</h4>
            <template v-for="top in data.top.filter(x => x.group === g)" :key="top.group">
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
            </template>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
