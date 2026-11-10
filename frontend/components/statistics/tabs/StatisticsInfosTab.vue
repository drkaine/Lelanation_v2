<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import { usePagination } from '~/composables/usePagination'
import { compareVersionsDesc } from '~/utils/statistics/statsVersion'
import { infosSummary, type InfosRow } from '~/utils/statistics/infosSummary'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
type InfosSortKey = 'version' | 'total'

const infosSortBy = ref<InfosSortKey>('version')
const infosSortDir = ref<'asc' | 'desc'>('desc')
const sortedInfosRows = computed(() => {
  const rows = [...(p.infosMatrixRows ?? [])]
  const dir = infosSortDir.value === 'asc' ? 1 : -1
  rows.sort((a, b) => {
    if (infosSortBy.value === 'total') {
      const av = cellValue(a, 'ALL')
      const bv = cellValue(b, 'ALL')
      if (av !== bv) return dir * (av - bv)
      return compareVersionsDesc(String(a.version ?? ''), String(b.version ?? ''))
    }
    const versionCmp = compareVersionsDesc(String(a.version ?? ''), String(b.version ?? ''))
    return infosSortDir.value === 'desc' ? versionCmp : -versionCmp
  })
  return rows
})

const { page, pageSize, totalRowsCount, totalPages, paginatedRows } = usePagination(
  sortedInfosRows,
  { resetOn: [() => p.infosMatrixRows, infosSortBy, infosSortDir] }
)

const infosMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => [
  { value: 'version', label: p.t('statisticsPage.mobileSortInfosVersion') },
  { value: 'total', label: p.t('statisticsPage.mobileSortInfosTotal') },
])

const infosMatrixColumns = computed(() => p.infosMatrixColumns ?? [])

const infosDivisionColumns = computed(() =>
  infosMatrixColumns.value.filter((d: string) => d !== 'ALL')
)

const summary = computed(() =>
  infosSummary((p.infosMatrixRows ?? []) as InfosRow[], infosDivisionColumns.value)
)
const { locale } = useI18n()
const fmtInt = (v: number) => v.toLocaleString(locale.value === 'en' ? 'en-US' : 'fr-FR')

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
      <div v-if="summary.patches.length" class="infos-summary">
        <article class="infos-card">
          <h3 class="infos-card-title">{{ p.t('statisticsPage.infosGamesTitle') }}</h3>
          <p class="infos-total">{{ fmtInt(summary.total) }}</p>
          <span class="infos-sub">
            {{ p.t('statisticsPage.infosGamesSub', { n: summary.patches.length }) }}
          </span>
          <div
            class="infos-bars"
            role="img"
            :aria-label="summary.patches.map(x => `${x.version} ${fmtInt(x.games)}`).join(', ')"
          >
            <div
              v-for="(x, i) in summary.patches"
              :key="x.version"
              class="infos-bar"
              :title="`${x.version} · ${fmtInt(x.games)}`"
            >
              <div
                class="infos-bar-fill"
                :class="{ 'is-last': i === summary.patches.length - 1 }"
                :style="{ height: `${x.heightPct}%` }"
              />
              <span class="infos-bar-label">{{ x.version }}</span>
            </div>
          </div>
        </article>
        <article v-if="summary.divisions.length" class="infos-card">
          <h3 class="infos-card-title">
            {{ p.t('statisticsPage.infosDivisionTitle', { version: summary.latestVersion }) }}
          </h3>
          <span v-if="summary.core" class="infos-sub">
            {{
              p.t('statisticsPage.infosDivisionCore', {
                pct: summary.core.sharePct,
                from: divisionLabel(summary.core.from),
                to: divisionLabel(summary.core.to),
              })
            }}
          </span>
          <div v-for="d in summary.divisions" :key="d.division" class="infos-div-row">
            <span class="infos-div-name">{{ divisionLabel(d.division) }}</span>
            <div class="infos-div-track">
              <div class="infos-div-fill" :style="{ width: `${d.widthPct}%` }" />
            </div>
            <span class="infos-div-num">{{ fmtInt(d.games) }} · {{ d.sharePct }} %</span>
          </div>
        </article>
      </div>
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
            class="statistics-infos-mobile-card w-full overflow-hidden"
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
                <div class="text-2xl font-bold tabular-nums leading-none text-text-accent">
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

        <div class="ui-build-card-surface hidden overflow-x-auto rounded-xl p-1 md:block">
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
                      loading="lazy"
                      decoding="async"
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

        <StatisticsRangePagination
          v-model:page="page"
          v-model:page-size="pageSize"
          class="statistics-tab-pagination statistics-infos-pagination px-3 py-2 text-sm"
          :total-count="totalRowsCount"
          :total-pages="totalPages"
        >
          {{ totalRowsCount }} {{ p.t('statisticsPage.infosMatrixPatchHeader') }}
        </StatisticsRangePagination>
      </div>
      <div v-else class="statistics-empty-panel p-4">
        {{ p.t('statisticsPage.noData') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .statistics-infos-mobile-card {
    width: 100%;
  }
}
</style>

<style scoped>
.infos-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.infos-card {
  border: 1px solid rgb(200 155 60 / 0.3);
  border-radius: 8px;
  padding: 12px;
}
.infos-card-title {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 16px;
  font-weight: 700;
  color: var(--color-gold-50, #f0e6d2);
}
.infos-total {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--color-gold-300, #c89b3c);
}
.infos-sub {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-grey-50, #a09b8c);
}
.infos-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 120px;
  padding-bottom: 18px;
}
.infos-bar {
  position: relative;
  display: flex;
  flex: 1;
  height: 100%;
  align-items: flex-end;
}
.infos-bar-fill {
  width: 100%;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
  background: #5b5a56;
}
.infos-bar-fill.is-last {
  background: var(--color-gold-300, #c89b3c);
}
.infos-bar-label {
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--color-grey-50, #a09b8c);
  white-space: nowrap;
}
.infos-div-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 13px;
}
.infos-div-track {
  height: 8px;
  border-radius: 4px;
  background: rgb(160 155 140 / 0.15);
  overflow: hidden;
}
.infos-div-fill {
  height: 100%;
  background: var(--color-blue-100, #0ac8b9);
}
.infos-div-num {
  font-variant-numeric: tabular-nums;
  color: var(--color-grey-50, #a09b8c);
}
</style>
