<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'

const p = inject('statisticsPageCtx') as any
const pageSize = ref<number>(20)
const page = ref<number>(1)
type InfosSortKey = 'version' | 'total'

const infosSortBy = ref<InfosSortKey>('version')
const infosSortDir = ref<'asc' | 'desc'>('desc')
const PAGE_SIZE_OPTIONS = computed<number[]>(() =>
  Array.isArray(p.PAGE_SIZE_OPTIONS) && p.PAGE_SIZE_OPTIONS.length > 0
    ? p.PAGE_SIZE_OPTIONS
    : [10, 20, 50, 100]
)
const totalRowsCount = computed<number>(() => (p.infosMatrixRows ?? []).length)
const totalPages = computed<number>(() =>
  Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value))
)
function compareVersions(a: string, b: string): number {
  const cmp = p.compareVersionsDesc?.(a, b)
  if (typeof cmp === 'number') return cmp
  const pa = String(a)
    .split('.')
    .map(x => Number(x))
  const pb = String(b)
    .split('.')
    .map(x => Number(x))
  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const da = Number.isFinite(pa[i]) ? (pa[i] as number) : 0
    const db = Number.isFinite(pb[i]) ? (pb[i] as number) : 0
    if (da !== db) return db - da
  }
  return String(b).localeCompare(String(a))
}

const sortedInfosRows = computed(() => {
  const rows = [...(p.infosMatrixRows ?? [])]
  const dir = infosSortDir.value === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    if (infosSortBy.value === 'total') {
      const av = cellValue(a, 'ALL')
      const bv = cellValue(b, 'ALL')
      if (av !== bv) return dir * (av - bv)
      return compareVersions(String(a.version ?? ''), String(b.version ?? ''))
    }
    const versionCmp = compareVersions(String(a.version ?? ''), String(b.version ?? ''))
    return infosSortDir.value === 'desc' ? versionCmp : -versionCmp
  })
  return rows
})

const paginatedRows = computed(() => {
  const rows = sortedInfosRows.value
  const pnum = Math.min(page.value, totalPages.value)
  const start = (pnum - 1) * pageSize.value
  return rows.slice(start, start + pageSize.value)
})

const infosMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => [
  { value: 'version', label: p.t('statisticsPage.mobileSortInfosVersion') },
  { value: 'total', label: p.t('statisticsPage.mobileSortInfosTotal') },
])

const infosMatrixColumns = computed(() => p.infosMatrixColumns ?? [])

const infosDivisionColumns = computed(() =>
  infosMatrixColumns.value.filter((d: string) => d !== 'ALL')
)

function divisionLabel(division: string): string {
  if (division === 'ALL') return p.t('statisticsPage.overviewVersionAll')
  return p.formatDivisionLabel(division)
}

function cellValue(
  row: { version: string; all: number; byDivision: Record<string, number> },
  division: string
): number {
  return Number(p.infosMatrixCell(row, division))
}

watch(
  () => [p.infosMatrixRows, pageSize.value, infosSortBy.value, infosSortDir.value],
  () => {
    page.value = 1
  }
)
</script>

<template>
  <div class="space-y-2">
    <div v-if="p.overviewPending || p.infosMatrixPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.overviewError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.overviewError }}
    </div>
    <div
      v-else-if="p.infosMatrixError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.infosMatrixError }}
    </div>
    <div v-else class="statistics-infos-tab space-y-3">
      <div v-if="paginatedRows.length" class="space-y-3">
        <StatisticsMobileSortBar
          id="infos-mobile-sort"
          v-model:column="infosSortBy"
          v-model:direction="infosSortDir"
          :options="infosMobileSortOptions"
        />
        <div class="statistics-infos-mobile-list space-y-2 md:hidden">
          <article
            v-for="row in paginatedRows"
            :key="'infos-mobile-' + row.version"
            class="statistics-infos-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
          >
            <div
              class="flex items-center justify-between gap-3 border-b border-primary/15 px-3.5 py-3"
            >
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-wide text-text/55">
                  {{ p.t('statisticsPage.infosMatrixPatchHeader') }}
                </div>
                <div class="text-lg font-bold text-accent">{{ row.version }}</div>
              </div>
              <div class="text-right">
                <div class="text-[10px] uppercase tracking-wide text-text/55">
                  {{ p.t('statisticsPage.overviewVersionAll') }}
                </div>
                <div class="text-2xl font-bold tabular-nums leading-none text-amber-300">
                  {{ cellValue(row, 'ALL').toLocaleString() }}
                </div>
              </div>
            </div>
            <div
              v-if="infosDivisionColumns.length"
              class="grid gap-2 px-3 py-3"
              :style="{
                gridTemplateColumns: `repeat(${Math.min(infosDivisionColumns.length, 4)}, minmax(0, 1fr))`,
              }"
            >
              <div
                v-for="division in infosDivisionColumns"
                :key="'infos-mobile-div-' + row.version + '-' + division"
                class="flex min-w-0 flex-col items-center gap-1 rounded-md bg-black/15 px-1.5 py-2 text-center"
              >
                <img
                  v-if="p.getRankedEmblemUrl(division)"
                  :src="p.getRankedEmblemUrl(division)!"
                  :alt="divisionLabel(division)"
                  class="h-6 w-6 object-contain"
                  loading="lazy"
                />
                <span class="text-[9px] font-semibold uppercase tracking-wide text-text/55">
                  {{ divisionLabel(division) }}
                </span>
                <span class="text-sm font-bold tabular-nums text-text">
                  {{ cellValue(row, division).toLocaleString() }}
                </span>
              </div>
            </div>
          </article>
        </div>

        <div
          class="hidden overflow-x-auto rounded-lg border border-primary/30 bg-surface/30 p-1 md:block"
        >
          <table class="w-full min-w-[760px] text-left text-sm">
            <thead class="border-b border-primary/30 bg-surface/50">
              <tr>
                <th
                  scope="col"
                  class="w-12 px-2 py-1.5 text-center font-semibold text-text"
                  :title="p.t('statisticsPage.infosMatrixPatchHeader')"
                >
                  {{ p.t('statisticsPage.infosMatrixPatchHeader') }}
                </th>
                <th
                  v-for="division in infosMatrixColumns"
                  :key="'infos-col-' + division"
                  scope="col"
                  class="px-2 py-1.5 text-center font-semibold text-text"
                  :title="divisionLabel(division)"
                >
                  <span class="sr-only">{{ divisionLabel(division) }}</span>
                  <div class="flex justify-center">
                    <img
                      v-if="division !== 'ALL' && p.getRankedEmblemUrl(division)"
                      :src="p.getRankedEmblemUrl(division)!"
                      alt=""
                      class="h-5 w-5 object-contain"
                    />
                    <span
                      v-else
                      class="text-[11px] font-semibold uppercase tracking-wide text-text/85"
                    >
                      {{ p.t('statisticsPage.overviewVersionAll') }}
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr v-for="row in paginatedRows" :key="'infos-row-' + row.version">
                <td class="px-3 py-1 font-medium text-text">{{ row.version }}</td>
                <td
                  v-for="division in infosMatrixColumns"
                  :key="'infos-cell-' + row.version + '-' + division"
                  class="px-2 py-1 text-center tabular-nums text-text/90"
                >
                  {{ cellValue(row, division).toLocaleString() }}
                </td>
              </tr>
              <tr v-if="(p.infosMatrixRows ?? []).length === 0">
                <td
                  :colspan="infosMatrixColumns.length + 1"
                  class="px-3 py-2 text-center text-text/70"
                >
                  {{ p.t('statisticsPage.noData') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="totalRowsCount > 0"
          class="statistics-infos-pagination flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-surface/20 px-3 py-2 text-sm text-text/80 md:rounded-lg md:border md:border-primary/30 md:bg-surface/30"
        >
          <span>{{ totalRowsCount }} {{ p.t('statisticsPage.infosMatrixPatchHeader') }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                v-model.number="pageSize"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
              >
                <option v-for="n in PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (page - 1) * pageSize + 1 }}-{{ Math.min(page * pageSize, totalRowsCount) }} /
              {{ totalRowsCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="page <= 1"
                @click="page = Math.max(1, page - 1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="page >= totalPages"
                @click="page = Math.min(totalPages, page + 1)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="rounded-lg border border-primary/30 bg-surface/20 p-4 text-text/70">
        {{ p.t('statisticsPage.noData') }}
      </div>

      <div class="rounded-lg border border-primary/30 bg-surface/20 p-2">
        <img
          src="/images/champion-balance-framework.png"
          alt="Champion Balance Framework"
          class="mx-auto w-full max-w-3xl rounded object-contain"
          loading="lazy"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .statistics-infos-tab {
    margin-inline: -1rem;
    width: calc(100% + 2rem);
    max-width: 100vw;
  }

  .statistics-infos-mobile-card {
    width: 100%;
  }
}
</style>
