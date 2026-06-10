<script setup lang="ts">
import { computed, inject } from 'vue'
import {
  VISION_METRIC_KEYS,
  visionMobileSortOptions,
  type VisionMetricKey,
  type VisionSortCol,
  type VisionTableRow,
} from '~/composables/statistics/useStatisticsVisionTab'

const p = inject('statisticsPageCtx') as Record<string, any>

const visionMobileSortColumn = computed({
  get: () => String(p.visionSortColumn ?? 'visionScore'),
  set: (v: string) => {
    ;(p.setVisionSort as (c: VisionSortCol) => void)?.(v as VisionSortCol)
  },
})

const visionMobileSortDir = computed({
  get: () => (p.visionSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.visionSortDir = v
  },
})

const visionMobileSortOptionsComputed = computed(() =>
  visionMobileSortOptions((key: string) => String(p.t?.(key) ?? key))
)

function championPortraitSrc(championId: number): string | null {
  if (!p.gameVersion || !p.championByKey(championId)) return null
  return p.getChampionImageUrl(p.gameVersion, p.championByKey(championId)!.image.full)
}

function formatVisionValue(key: VisionMetricKey, value: number): string {
  const n = Number(value)
  if (key === 'visionScore') return n.toFixed(1)
  return n.toFixed(2)
}

function formatVisionDelta(key: VisionMetricKey, value: number): string {
  const sign = value > 0 ? '+' : ''
  if (key === 'visionScore') return `${sign}${Number(value).toFixed(1)}`
  return `${sign}${Number(value).toFixed(2)}`
}

function visionValue(row: VisionTableRow, key: VisionMetricKey): number {
  return Number(row[key] ?? 0)
}

function visionDelta(row: VisionTableRow, key: VisionMetricKey): number | null {
  return p.visionDelta?.(row, key) ?? null
}

function sortIndicator(col: VisionSortCol): string {
  return p.visionSortHint?.(col) ?? ''
}

function visionMessage(message: string | undefined): string {
  if (!message) return ''
  if (message === 'Database not configured.' || message === 'Database not configured') {
    return String(p.t?.('statisticsPage.visionDbNotConfigured') ?? message)
  }
  return message
}

function deltaSortKey(key: VisionMetricKey): VisionSortCol {
  return `${key}Delta`
}

const visionPageSize = computed({
  get: () => Number(p.championsPageSize) || 20,
  set: (value: number) => {
    p.onVisionPageSizeUpdated?.(value)
  },
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="p.visionPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.visionError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.visionError }}
    </div>
    <div
      v-else-if="p.visionTableData?.message && !p.visionTableData?.rows?.length"
      class="text-text/70"
    >
      {{ visionMessage(p.visionTableData.message) }}
    </div>
    <div v-else-if="!p.paginatedVisionRows?.length" class="text-text/70">
      {{ p.t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <StatisticsMobileSortBar
        id="vision-mobile-sort"
        v-model:column="visionMobileSortColumn"
        v-model:direction="visionMobileSortDir"
        :options="visionMobileSortOptionsComputed"
      />

      <div class="statistics-vision-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedVisionRows"
          :key="'vision-mobile-' + row.championId"
          class="statistics-champion-stats-mobile-card statistics-vision-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
        >
          <div
            class="statistics-champion-stats-mobile-card-header flex w-full items-center gap-3 p-3"
          >
            <StatisticsChampionStatsMobileCardHeader
              :champion-id="row.championId"
              :champion-name="String(p.championName(row.championId) || row.championId)"
              :search-query="p.championSearchQuery"
              :portrait-src="championPortraitSrc(row.championId)"
              :portrait-alt="p.championName(row.championId) || ''"
            />
            <div class="min-w-0 flex-1 text-right">
              <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                {{ p.t('statisticsPage.visionMetric.visionScore') }}
              </div>
              <div class="text-2xl font-bold tabular-nums leading-none text-text sm:text-3xl">
                {{ formatVisionValue('visionScore', row.visionScore) }}
              </div>
              <div
                v-if="visionDelta(row, 'visionScore') != null"
                class="mt-0.5 text-xs tabular-nums leading-none"
                :class="p.championGlobalNumericDeltaClass(visionDelta(row, 'visionScore')!)"
              >
                {{ formatVisionDelta('visionScore', visionDelta(row, 'visionScore')!) }}
              </div>
            </div>
          </div>
          <div class="border-t border-primary/15 px-3 py-2.5">
            <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div
                v-for="key in VISION_METRIC_KEYS.filter(k => k !== 'visionScore')"
                :key="'vision-mobile-metric-' + row.championId + '-' + key"
                class="rounded bg-primary/10 px-2 py-1.5"
              >
                <div class="text-[10px] uppercase text-text/55">
                  {{ p.t('statisticsPage.visionMetric.' + key) }}
                </div>
                <div class="font-bold tabular-nums text-text">
                  {{ formatVisionValue(key, visionValue(row, key)) }}
                </div>
                <div
                  v-if="visionDelta(row, key) != null"
                  class="mt-0.5 text-[10px] tabular-nums leading-none"
                  :class="p.championGlobalNumericDeltaClass(visionDelta(row, key)!)"
                >
                  {{ formatVisionDelta(key, visionDelta(row, key)!) }}
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div
        class="tier-list-mobile-rotate statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px] max-lg:min-w-[720px]">
          <table class="w-full min-w-[520px] text-left text-[13px]">
            <thead
              class="sticky top-0 z-10 border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
            >
              <tr>
                <th class="min-w-[220px] px-2 py-1.5 text-left font-semibold text-text">
                  {{ p.t('statisticsPage.tierListColChampion') }}
                </th>
                <th
                  v-for="key in VISION_METRIC_KEYS"
                  :key="'vision-th-' + key"
                  class="cursor-pointer select-none px-3 py-1.5 font-semibold text-text"
                >
                  <div class="flex items-center justify-center gap-1">
                    <button type="button" @click="p.setVisionSort(key)">
                      {{ p.t('statisticsPage.visionMetric.' + key) }}{{ sortIndicator(key) }}
                    </button>
                    <button
                      v-if="p.visionTableRefData"
                      type="button"
                      class="text-[10px] text-text/70 hover:text-text"
                      :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                      @click="p.setVisionSort(deltaSortKey(key))"
                    >
                      Δ{{ sortIndicator(deltaSortKey(key)) }}
                    </button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="row in p.paginatedVisionRows"
                :key="'vision-' + row.championId"
                class="text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
              >
                <td class="min-w-[220px] py-0.5 pl-2 pr-0">
                  <StatisticsChampionDetailLink
                    :champion-id="row.championId"
                    class="flex items-center gap-2"
                  >
                    <img
                      v-if="championPortraitSrc(row.championId)"
                      :src="championPortraitSrc(row.championId)!"
                      :alt="p.championName(row.championId) || ''"
                      class="h-[50px] w-[50px] shrink-0 border-2 border-black object-cover"
                      width="50"
                      height="50"
                      loading="lazy"
                      decoding="async"
                    />
                    <span
                      class="min-w-0 truncate text-[12px] text-accent underline decoration-accent/40 underline-offset-2"
                    >
                      <StatisticsChampionNameHighlight
                        :name="String(p.championName(row.championId) || row.championId)"
                        :query="p.championSearchQuery"
                      />
                    </span>
                  </StatisticsChampionDetailLink>
                </td>
                <td
                  v-for="key in VISION_METRIC_KEYS"
                  :key="'vision-td-' + row.championId + '-' + key"
                  class="px-1 py-0.5 align-middle"
                >
                  <div
                    class="flex min-h-[60px] flex-col items-center justify-center gap-0 text-center tabular-nums leading-tight"
                    :class="key === 'visionScore' ? 'font-semibold' : ''"
                  >
                    <span>{{ formatVisionValue(key, visionValue(row, key)) }}</span>
                    <span
                      v-if="visionDelta(row, key) != null"
                      class="text-[10px] leading-none"
                      :class="p.championGlobalNumericDeltaClass(visionDelta(row, key)!)"
                    >
                      {{ formatVisionDelta(key, visionDelta(row, key)!) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            v-if="p.totalVisionCount > 0"
            class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
          >
            <span v-if="p.championSearchQuery"
              >{{ p.t('statisticsPage.showing') }} {{ p.totalVisionCount }}</span
            >
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5">
                <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
                <select
                  v-model.number="visionPageSize"
                  class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                >
                  <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="'vision-ps-' + n" :value="n">
                    {{ n }}
                  </option>
                </select>
              </label>
              <span class="text-text/70">
                {{
                  p.t('statisticsPage.pageXOfY', {
                    current: p.visionPage,
                    total: p.totalVisionPages,
                  })
                }}
              </span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                  :disabled="p.visionPage <= 1"
                  @click="p.onVisionPageUpdated(Math.max(1, p.visionPage - 1))"
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                  :disabled="p.visionPage >= p.totalVisionPages"
                  @click="p.onVisionPageUpdated(Math.min(p.totalVisionPages, p.visionPage + 1))"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
