<script setup lang="ts">
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import {
  VISION_METRIC_KEYS,
  visionMobileSortOptions,
  type VisionMetricKey,
  type VisionSortCol,
  type VisionTableRow,
} from '~/composables/statistics/useStatisticsVisionTab'

const p = inject('statisticsPageCtx') as Record<string, unknown>

const championsStore = useChampionsStore()
const { currentVersion: gameVersionFromStore } = storeToRefs(useVersionStore())

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

function championById(championId: number) {
  return championsStore.champions.find(c => Number(c.key) === championId) ?? null
}

function championLabel(row: VisionTableRow): string {
  return championById(row.championId)?.name ?? String(row.championId)
}

function championImageUrl(row: VisionTableRow): string | null {
  const version = String(p.gameVersion ?? gameVersionFromStore.value ?? '').trim()
  const champion = championById(row.championId)
  if (!version || !champion?.image?.full) return null
  return getChampionImageUrl(version, champion.image.full)
}

function formatVisionValue(key: VisionMetricKey, value: number): string {
  const n = Number(value)
  if (key === 'visionScore') return n.toFixed(1)
  return n.toFixed(2)
}

function visionValue(row: VisionTableRow, key: VisionMetricKey): number {
  return Number(row[key] ?? 0)
}

function sortIndicator(col: VisionSortCol): string {
  if (p.visionSortColumn !== col) return ''
  return p.visionSortDir === 'asc' ? ' ▲' : ' ▼'
}

function visionMessage(message: string | undefined): string {
  if (!message) return ''
  if (message === 'Database not configured.' || message === 'Database not configured') {
    return String(p.t?.('statisticsPage.visionDbNotConfigured') ?? message)
  }
  return message
}
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
          class="statistics-vision-mobile-card rounded-lg border border-primary/30 bg-surface/40 p-3"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="championImageUrl(row)"
              :src="championImageUrl(row)!"
              :alt="championLabel(row)"
              class="h-11 w-11 shrink-0 rounded-full object-cover"
              width="44"
              height="44"
            />
            <div
              v-else
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-text/70"
            >
              ?
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-accent">{{ championLabel(row) }}</div>
            </div>
            <div class="text-right">
              <div class="text-[10px] uppercase text-text/50">
                {{ p.t('statisticsPage.visionMetric.visionScore') }}
              </div>
              <div class="text-xl font-bold tabular-nums text-text">
                {{ formatVisionValue('visionScore', row.visionScore) }}
              </div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div
              v-for="key in VISION_METRIC_KEYS"
              :key="'vision-mobile-metric-' + row.championId + '-' + key"
              class="rounded bg-primary/10 px-2 py-1.5"
            >
              <div class="text-[10px] uppercase text-text/55">
                {{ p.t('statisticsPage.visionMetric.' + key) }}
              </div>
              <div class="font-bold tabular-nums text-text">
                {{ formatVisionValue(key, visionValue(row, key)) }}
              </div>
            </div>
          </div>
        </article>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="statistics-table w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr
              class="border-b border-primary/30 text-left text-xs uppercase tracking-wide text-text/60"
            >
              <th class="sticky left-0 z-[1] bg-surface px-2 py-2">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setVisionSort('champion')"
                >
                  {{ p.t('statisticsPage.visionColChampion') }}{{ sortIndicator('champion') }}
                </button>
              </th>
              <th
                v-for="key in VISION_METRIC_KEYS"
                :key="'vision-th-' + key"
                class="px-2 py-2 text-right"
              >
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setVisionSort(key)"
                >
                  {{ p.t('statisticsPage.visionMetric.' + key) }}{{ sortIndicator(key) }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in p.paginatedVisionRows"
              :key="'vision-' + row.championId"
              class="border-b border-primary/15 hover:bg-primary/5"
            >
              <td class="sticky left-0 z-[1] bg-surface px-2 py-2">
                <div class="flex min-w-0 items-center gap-2">
                  <img
                    v-if="championImageUrl(row)"
                    :src="championImageUrl(row)!"
                    :alt="championLabel(row)"
                    class="h-8 w-8 shrink-0 rounded-full object-cover"
                    width="32"
                    height="32"
                  />
                  <div class="min-w-0 truncate font-medium text-text">{{ championLabel(row) }}</div>
                </div>
              </td>
              <td
                v-for="key in VISION_METRIC_KEYS"
                :key="'vision-td-' + row.championId + '-' + key"
                class="px-2 py-2 text-right tabular-nums"
                :class="key === 'visionScore' ? 'font-semibold' : ''"
              >
                {{ formatVisionValue(key, visionValue(row, key)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <StatisticsTabPagination
        v-if="p.totalVisionPages > 1"
        :page="p.visionPage"
        :total-pages="p.totalVisionPages"
        @prev="p.onVisionPageUpdated(Math.max(1, p.visionPage - 1))"
        @next="p.onVisionPageUpdated(Math.min(p.totalVisionPages, p.visionPage + 1))"
      />
    </template>
  </div>
</template>
