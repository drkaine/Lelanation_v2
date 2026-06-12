<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { miscMobileSortOptions } from '~/composables/statistics/useStatisticsMiscTab'
import {
  CHAMPION_MISC_BASE_STAT_KEYS,
  CHAMPION_MISC_GROWTH_STAT_KEYS,
  CHAMPION_MISC_STAT_ICON_KEYS,
  championMiscStatUnavailable,
  championMiscStatValueAtLevel,
  formatChampionMiscStatValue,
  type ChampionMiscBaseStatKey,
  type ChampionMiscGrowthStatKey,
  type ChampionMiscSortCol,
  type ChampionMiscStatRow,
} from '~/utils/championBaseStatsFromJson'
import {
  championMiscStatDisplayName,
  championMiscStatRowKey,
} from '~/utils/championMiscStatVariants'
import {
  getChampionStatIconImageClass,
  getChampionStatIconSrc,
  getChampionStatIconToneClass,
} from '~/utils/championStatIcons'

const p = inject('statisticsPageCtx') as Record<string, any>

const MISC_MOBILE_PREVIEW_KEYS = [
  'hp',
  'attackDamage',
  'attackSpeed',
] as const satisfies readonly ChampionMiscBaseStatKey[]

const MISC_MOBILE_EXPANDED_KEYS = CHAMPION_MISC_BASE_STAT_KEYS.filter(
  key => !(MISC_MOBILE_PREVIEW_KEYS as readonly string[]).includes(key)
)

const expandedMiscRowKeys = ref<Set<string>>(new Set())

watch(
  () => p.paginatedMiscRows,
  () => {
    expandedMiscRowKeys.value = new Set()
  }
)

function toggleMiscCardExpanded(row: ChampionMiscStatRow): void {
  const key = rowKey(row)
  const next = new Set(expandedMiscRowKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedMiscRowKeys.value = next
}

function isMiscCardExpanded(row: ChampionMiscStatRow): boolean {
  return expandedMiscRowKeys.value.has(rowKey(row))
}

const miscMobileSortColumn = computed({
  get: () => String(p.miscSortColumn ?? 'base_hp'),
  set: (v: string) => {
    ;(p.setMiscSort as (c: ChampionMiscSortCol) => void)?.(v as ChampionMiscSortCol)
  },
})

const miscMobileSortDir = computed({
  get: () => (p.miscSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.miscSortDir = v
  },
})

const miscMobileSortOptionsComputed = computed(() =>
  miscMobileSortOptions((key: string) => String(p.t?.(key) ?? key))
)

const miscPageSize = computed({
  get: () => Number(p.championsPageSize) || 20,
  set: (value: number) => {
    p.onMiscPageSizeUpdated?.(value)
  },
})

const miscLevel = computed(() => Number(p.miscLevel) || 1)

const baseColumnLabel = computed(() => {
  if (miscLevel.value <= 1) return String(p.t?.('statisticsPage.miscColBase') ?? 'Base')
  return String(
    p.t?.('statisticsPage.miscColAtLevel', { level: miscLevel.value }) ?? miscLevel.value
  )
})

function championPortraitSrc(row: ChampionMiscStatRow): string | null {
  if (!p.gameVersion || !row.imageFull) return null
  return p.getChampionImageUrl(p.gameVersion, row.imageFull)
}

function statLabel(key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey): string {
  const iconKey = CHAMPION_MISC_STAT_ICON_KEYS[key]
  return String(p.t?.(`stats.labels.${iconKey}`) ?? key)
}

function statIconKey(key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey): string {
  return CHAMPION_MISC_STAT_ICON_KEYS[key]
}

function statIconSrc(key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey): string | null {
  return getChampionStatIconSrc(statIconKey(key))
}

function statIconToneClass(key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey): string {
  return getChampionStatIconToneClass(statIconKey(key))
}

function statIconImageClass(key: ChampionMiscBaseStatKey | ChampionMiscGrowthStatKey): string {
  return getChampionStatIconImageClass(statIconKey(key))
}

function baseSortCol(key: ChampionMiscBaseStatKey): ChampionMiscSortCol {
  return `base_${key}`
}

function growthSortCol(key: ChampionMiscGrowthStatKey): ChampionMiscSortCol {
  return `growth_${key}`
}

function hasMiscGrowthColumn(key: ChampionMiscBaseStatKey): boolean {
  return (CHAMPION_MISC_GROWTH_STAT_KEYS as readonly string[]).includes(key)
}

function sortIndicator(col: ChampionMiscSortCol): string {
  return p.miscSortHint?.(col) ?? ''
}

function miscUnavailableLabel(): string {
  return String(p.t?.('statisticsPage.miscStatNA') ?? 'NA')
}

function formatBase(row: ChampionMiscStatRow, key: ChampionMiscBaseStatKey): string {
  if (championMiscStatUnavailable(row, key)) return miscUnavailableLabel()
  return formatChampionMiscStatValue(key, championMiscStatValueAtLevel(row, key, miscLevel.value))
}

function formatGrowth(row: ChampionMiscStatRow, key: ChampionMiscGrowthStatKey): string {
  if (championMiscStatUnavailable(row, key)) return miscUnavailableLabel()
  return formatChampionMiscStatValue(key, row.growth[key] ?? 0)
}

function formatGrowthDisplay(row: ChampionMiscStatRow, key: ChampionMiscGrowthStatKey): string {
  if (championMiscStatUnavailable(row, key)) return miscUnavailableLabel()
  return `+${formatGrowth(row, key)}`
}

function rowDisplayName(row: ChampionMiscStatRow): string {
  return championMiscStatDisplayName(row, (key: string) => String(p.t?.(key) ?? key))
}

function rowKey(row: ChampionMiscStatRow): string {
  return championMiscStatRowKey(row.championId, row.variant)
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="p.miscPending" class="text-text/70">{{ p.t('statisticsPage.loading') }}</div>
    <div v-else-if="p.miscError" class="rounded border border-error bg-surface p-3 text-error">
      {{ p.miscError }}
    </div>
    <div v-else-if="!p.paginatedMiscRows?.length" class="text-text/70">
      {{ p.t('statisticsPage.noData') }}
    </div>
    <template v-else>
      <StatisticsMobileSortBar
        id="misc-mobile-sort"
        v-model:column="miscMobileSortColumn"
        v-model:direction="miscMobileSortDir"
        :options="miscMobileSortOptionsComputed"
      />

      <div class="statistics-misc-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedMiscRows"
          :key="'misc-mobile-' + rowKey(row)"
          class="statistics-champion-stats-mobile-card statistics-misc-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
        >
          <div
            class="statistics-champion-stats-mobile-card-header flex w-full items-start gap-3 p-3"
          >
            <StatisticsChampionStatsMobileCardHeader
              :champion-id="row.championId"
              :champion-name="rowDisplayName(row)"
              :search-query="p.championSearchQuery"
              :portrait-src="championPortraitSrc(row)"
              :portrait-alt="rowDisplayName(row)"
            />
          </div>

          <div class="border-t border-primary/15 px-3 py-2.5">
            <div class="grid grid-cols-3 gap-2">
              <div
                v-for="key in MISC_MOBILE_PREVIEW_KEYS"
                :key="'misc-mobile-preview-' + rowKey(row) + '-' + key"
                class="flex min-w-0 flex-col gap-1 rounded border border-primary/20 bg-black/15 px-2 py-1.5"
              >
                <span class="inline-flex min-w-0 items-center gap-1 text-[10px] text-text/70">
                  <span
                    v-if="statIconSrc(key)"
                    class="stat-inline-icon stat-inline-icon--sm shrink-0"
                    :class="statIconToneClass(key)"
                    aria-hidden="true"
                  >
                    <img
                      :src="statIconSrc(key)!"
                      alt=""
                      :class="['stat-inline-icon-image', statIconImageClass(key)]"
                      width="14"
                      height="14"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span class="truncate">{{ statLabel(key) }}</span>
                </span>
                <span class="text-sm font-semibold tabular-nums leading-none text-text">
                  {{ formatBase(row, key) }}
                </span>
                <span
                  v-if="hasMiscGrowthColumn(key)"
                  class="text-[10px] tabular-nums leading-none text-text/60"
                >
                  {{ formatGrowthDisplay(row, key as ChampionMiscGrowthStatKey) }}
                </span>
              </div>
            </div>

            <button
              v-if="!isMiscCardExpanded(row)"
              type="button"
              class="mt-2 w-full text-center text-xs font-medium text-accent underline decoration-accent/40 underline-offset-2"
              @click="toggleMiscCardExpanded(row)"
            >
              {{ p.t('statisticsPage.miscShowMoreStats') }}
            </button>
          </div>

          <div
            v-if="isMiscCardExpanded(row)"
            class="space-y-2 border-t border-primary/20 bg-black/20 px-3 py-2.5"
          >
            <div
              v-for="key in MISC_MOBILE_EXPANDED_KEYS"
              :key="'misc-mobile-expanded-' + rowKey(row) + '-' + key"
              class="flex items-center justify-between gap-2 text-xs"
            >
              <span class="inline-flex min-w-0 items-center gap-1.5 text-text/75">
                <span
                  v-if="statIconSrc(key)"
                  class="stat-inline-icon stat-inline-icon--sm shrink-0"
                  :class="statIconToneClass(key)"
                  aria-hidden="true"
                >
                  <img
                    :src="statIconSrc(key)!"
                    alt=""
                    :class="['stat-inline-icon-image', statIconImageClass(key)]"
                    width="16"
                    height="16"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span class="truncate">{{ statLabel(key) }}</span>
              </span>
              <span class="shrink-0 tabular-nums text-text">
                <span class="font-semibold">{{ formatBase(row, key) }}</span>
                <template v-if="hasMiscGrowthColumn(key)">
                  <span class="text-text/45"> · </span>
                  <span class="text-text/70">{{
                    formatGrowthDisplay(row, key as ChampionMiscGrowthStatKey)
                  }}</span>
                </template>
              </span>
            </div>
            <button
              type="button"
              class="w-full text-center text-xs font-medium text-text/70 underline decoration-text/30 underline-offset-2"
              @click="toggleMiscCardExpanded(row)"
            >
              {{ p.t('statisticsPage.miscShowLessStats') }}
            </button>
          </div>
        </article>
      </div>

      <div
        class="tier-list-mobile-rotate statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <div class="tier-list-lolalytics w-full min-w-0 text-[13px] max-lg:min-w-[1100px]">
          <table class="w-full min-w-[1100px] text-left text-[13px]">
            <thead
              class="sticky top-0 z-10 border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
            >
              <tr>
                <th
                  class="sticky left-0 z-20 min-w-[200px] cursor-pointer select-none bg-[var(--color-grey-300)] px-2 py-1.5 text-left font-semibold text-text"
                  rowspan="2"
                  @click="p.setMiscSort('champion')"
                >
                  {{ p.t('statisticsPage.miscColChampion') }}{{ sortIndicator('champion') }}
                </th>
                <th
                  v-for="key in CHAMPION_MISC_BASE_STAT_KEYS"
                  :key="'misc-th-group-' + key"
                  :colspan="hasMiscGrowthColumn(key) ? 2 : 1"
                  class="border-l border-black/20 px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-text/80"
                >
                  <span class="inline-flex items-center justify-center gap-1">
                    <span
                      v-if="statIconSrc(key)"
                      class="stat-inline-icon stat-inline-icon--sm"
                      :class="statIconToneClass(key)"
                      aria-hidden="true"
                    >
                      <img
                        :src="statIconSrc(key)!"
                        alt=""
                        :class="['stat-inline-icon-image', statIconImageClass(key)]"
                        width="14"
                        height="14"
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    {{ statLabel(key) }}
                  </span>
                </th>
              </tr>
              <tr>
                <template v-for="key in CHAMPION_MISC_BASE_STAT_KEYS" :key="'misc-th-sub-' + key">
                  <th
                    class="cursor-pointer select-none border-l border-black/15 px-2 py-1 text-center text-[10px] font-semibold text-text"
                    @click="p.setMiscSort(baseSortCol(key))"
                  >
                    {{ baseColumnLabel }}{{ sortIndicator(baseSortCol(key)) }}
                  </th>
                  <th
                    v-if="hasMiscGrowthColumn(key)"
                    class="cursor-pointer select-none px-2 py-1 text-center text-[10px] font-semibold text-text"
                    @click="p.setMiscSort(growthSortCol(key as ChampionMiscGrowthStatKey))"
                  >
                    {{ p.t('statisticsPage.miscColGrowth')
                    }}{{ sortIndicator(growthSortCol(key as ChampionMiscGrowthStatKey)) }}
                  </th>
                </template>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="row in p.paginatedMiscRows"
                :key="'misc-' + rowKey(row)"
                class="text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
              >
                <td
                  class="sticky left-0 z-10 min-w-[200px] bg-inherit py-0.5 pl-2 pr-0 odd:bg-[rgb(255_255_255/0.04)] even:bg-[rgb(0_0_0/0.25)]"
                >
                  <StatisticsChampionDetailLink
                    :champion-id="row.championId"
                    class="flex items-center gap-2"
                  >
                    <img
                      v-if="championPortraitSrc(row)"
                      :src="championPortraitSrc(row)!"
                      :alt="rowDisplayName(row)"
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
                        :name="rowDisplayName(row)"
                        :query="p.championSearchQuery"
                      />
                    </span>
                  </StatisticsChampionDetailLink>
                </td>
                <template v-for="key in CHAMPION_MISC_BASE_STAT_KEYS" :key="'misc-td-' + key">
                  <td class="border-l border-primary/10 px-2 py-1 text-center tabular-nums">
                    {{ formatBase(row, key) }}
                  </td>
                  <td
                    v-if="hasMiscGrowthColumn(key)"
                    class="px-2 py-1 text-center tabular-nums text-text/80"
                  >
                    {{ formatGrowthDisplay(row, key as ChampionMiscGrowthStatKey) }}
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <StatisticsTabPagination
        v-model:page="p.miscPage"
        v-model:page-size="miscPageSize"
        :total-pages="p.totalMiscPages"
        :total-count="p.totalMiscCount"
        :page-size-options="p.PAGE_SIZE_OPTIONS"
      />
    </template>
  </div>
</template>
