<script setup lang="ts">
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import {
  PING_METRIC_KEYS,
  pingsMobileSortOptions,
  type PingMetricKey,
  type PingsSortCol,
  type PingsTableRow,
} from '~/composables/statistics/useStatisticsPingsTab'

const p = inject('statisticsPageCtx') as Record<string, unknown>

const championsStore = useChampionsStore()
const { currentVersion: gameVersionFromStore } = storeToRefs(useVersionStore())

const pingsMobileSortColumn = computed({
  get: () => String(p.pingsSortColumn ?? 'totalPerGame'),
  set: (v: string) => {
    ;(p.setPingsSort as (c: PingsSortCol) => void)?.(v as PingsSortCol)
  },
})

const pingsMobileSortDir = computed({
  get: () => (p.pingsSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.pingsSortDir = v
  },
})

const pingsMobileSortOptionsComputed = computed(() =>
  pingsMobileSortOptions((key: string) => String(p.t?.(key) ?? key))
)

function championById(championId: number) {
  return championsStore.champions.find(c => Number(c.key) === championId) ?? null
}

function championLabel(row: PingsTableRow): string {
  return championById(row.championId)?.name ?? String(row.championId)
}

function championImageUrl(row: PingsTableRow): string | null {
  const version = String(p.gameVersion ?? gameVersionFromStore.value ?? '').trim()
  const champion = championById(row.championId)
  if (!version || !champion?.image?.full) return null
  return getChampionImageUrl(version, champion.image.full)
}

function formatPing(value: number): string {
  return Number(value).toFixed(2)
}

function pingValue(row: PingsTableRow, key: PingMetricKey): number {
  return Number(row[key] ?? 0)
}

function sortIndicator(col: PingsSortCol): string {
  if (p.pingsSortColumn !== col) return ''
  return p.pingsSortDir === 'asc' ? ' ▲' : ' ▼'
}

function pingsMessage(message: string | undefined): string {
  if (!message) return ''
  if (message === 'Database not configured.' || message === 'Database not configured') {
    return String(p.t?.('statisticsPage.pingsDbNotConfigured') ?? message)
  }
  return message
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="p.pingsPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.pingsError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.pingsError }}
    </div>
    <div
      v-else-if="p.pingsTableData?.message && !p.pingsTableData?.rows?.length"
      class="text-text/70"
    >
      {{ pingsMessage(p.pingsTableData.message) }}
    </div>
    <div v-else-if="!p.paginatedPingsRows?.length" class="text-text/70">
      {{ p.t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <StatisticsMobileSortBar
        id="pings-mobile-sort"
        v-model:column="pingsMobileSortColumn"
        v-model:direction="pingsMobileSortDir"
        :options="pingsMobileSortOptionsComputed"
      />

      <div class="statistics-pings-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedPingsRows"
          :key="'ping-mobile-' + row.championId"
          class="statistics-pings-mobile-card rounded-lg border border-primary/30 bg-surface/40 p-3"
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
              <div class="text-[10px] uppercase tracking-wide text-text/50">
                {{ p.t('statisticsPage.pingsColGames') }}: {{ row.games.toLocaleString('fr-FR') }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-[10px] uppercase text-text/50">
                {{ p.t('statisticsPage.pingsColTotal') }}
              </div>
              <div class="text-xl font-bold tabular-nums text-text">
                {{ formatPing(row.totalPerGame) }}
              </div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div
              v-for="key in PING_METRIC_KEYS"
              :key="'ping-mobile-metric-' + row.championId + '-' + key"
              class="rounded bg-primary/10 px-2 py-1.5"
            >
              <div class="text-[10px] uppercase text-text/55">
                {{ p.t('statisticsPage.pingsMetric.' + key) }}
              </div>
              <div class="font-bold tabular-nums text-text">
                {{ formatPing(pingValue(row, key)) }}
              </div>
            </div>
          </div>
        </article>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="statistics-table w-full min-w-[72rem] border-collapse text-sm">
          <thead>
            <tr
              class="border-b border-primary/30 text-left text-xs uppercase tracking-wide text-text/60"
            >
              <th class="sticky left-0 z-[1] bg-surface px-2 py-2">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPingsSort('champion')"
                >
                  {{ p.t('statisticsPage.pingsColChampion') }}{{ sortIndicator('champion') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPingsSort('games')"
                >
                  {{ p.t('statisticsPage.pingsColGames') }}{{ sortIndicator('games') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right">
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPingsSort('totalPerGame')"
                >
                  {{ p.t('statisticsPage.pingsColTotal') }}{{ sortIndicator('totalPerGame') }}
                </button>
              </th>
              <th
                v-for="key in PING_METRIC_KEYS"
                :key="'ping-th-' + key"
                class="px-2 py-2 text-right"
              >
                <button
                  type="button"
                  class="font-semibold hover:text-text"
                  @click="p.setPingsSort(key)"
                >
                  {{ p.t('statisticsPage.pingsMetric.' + key) }}{{ sortIndicator(key) }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in p.paginatedPingsRows"
              :key="'ping-' + row.championId"
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
              <td class="px-2 py-2 text-right tabular-nums">
                {{ row.games.toLocaleString('fr-FR') }}
              </td>
              <td class="px-2 py-2 text-right font-semibold tabular-nums">
                {{ formatPing(row.totalPerGame) }}
              </td>
              <td
                v-for="key in PING_METRIC_KEYS"
                :key="'ping-td-' + row.championId + '-' + key"
                class="px-2 py-2 text-right tabular-nums"
              >
                {{ formatPing(pingValue(row, key)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <StatisticsTabPagination
        v-if="p.totalPingsPages > 1"
        :page="p.pingsPage"
        :total-pages="p.totalPingsPages"
        @prev="p.onPingsPageUpdated(Math.max(1, p.pingsPage - 1))"
        @next="p.onPingsPageUpdated(Math.min(p.totalPingsPages, p.pingsPage + 1))"
      />
    </template>
  </div>
</template>
