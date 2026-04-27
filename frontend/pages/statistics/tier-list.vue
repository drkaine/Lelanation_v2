<template>
  <div class="statistics flex min-h-screen flex-col text-text">
    <button
      type="button"
      class="filters-collapse-floating fixed left-3 top-2 z-[60] flex lg:hidden"
      :aria-label="filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')"
      @click="toggleFiltersOpen"
    >
      <svg
        class="h-2 w-2 transition-transform duration-200"
        :class="filtersOpen ? 'rotate-180' : ''"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div class="mt-[15px] flex min-h-0 flex-1 flex-col">
      <div
        class="flex w-full flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-primary/30 bg-surface/30 px-4 pb-2 pt-4"
      >
        <div class="flex shrink-0 flex-nowrap gap-1 overflow-x-auto">
          <button
            type="button"
            :class="[
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tierListViewModel === 'table'
                ? 'border border-accent/50 bg-accent/20 text-accent'
                : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
            ]"
            @click="setTierListViewModel('table')"
          >
            {{ t('statisticsPage.tierListViewTable') }}
          </button>
          <button
            type="button"
            :class="[
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tierListViewModel === 'chart'
                ? 'border border-accent/50 bg-accent/20 text-accent'
                : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
            ]"
            @click="setTierListViewModel('chart')"
          >
            {{ t('statisticsPage.tierListViewChart') }}
          </button>
        </div>
        <h2
          v-if="tierListViewModel === 'chart'"
          class="min-w-0 max-w-full truncate text-right text-[11px] font-bold uppercase tracking-tight text-text-accent sm:max-w-[min(100%,36rem)] sm:text-xs md:text-sm"
        >
          {{ tierListChartHeading }}
        </h2>
      </div>

      <div class="flex min-h-0 flex-1">
        <button
          type="button"
          class="filters-collapse-floating hidden lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:shrink-0 lg:self-start"
          :aria-label="
            filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
          "
          @click="toggleFiltersOpen"
        >
          <svg
            class="h-2 w-2 transition-transform duration-200"
            :class="filtersOpen ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <aside
          :class="[
            'fixed left-0 top-14 z-[50] flex h-[calc(100dvh-3.5rem)] w-72 max-w-[88vw] shrink-0 flex-col rounded-r-lg bg-surface/95 shadow-lg transition-transform duration-200',
            'lg:static lg:sticky lg:top-4 lg:z-0 lg:h-auto lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-lg lg:shadow-none lg:transition-[width,opacity] lg:duration-200',
            filtersOpen
              ? 'translate-x-0 lg:w-64 lg:opacity-100'
              : '-translate-x-full lg:w-0 lg:translate-x-0 lg:opacity-0',
          ]"
          @click.stop
        >
          <div
            class="flex shrink-0 items-center gap-2 border-b border-primary/25 p-2 lg:border-transparent lg:pb-2"
          >
            <h2 class="min-w-0 flex-1 truncate text-lg font-semibold text-text-accent">
              {{ t('statisticsPage.filtersTitle') }}
            </h2>
            <button
              type="button"
              class="inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/15 hover:text-blue-200"
              @click="resetStatsFilters"
            >
              <span class="iconify i-mdi:refresh" aria-hidden="true" />
              Reset
            </button>
            <button
              type="button"
              class="flex h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-lg text-text/90 hover:bg-primary/25 hover:text-text lg:hidden"
              :aria-label="t('statisticsPage.closeFilters')"
              @click="closeFilters"
            >
              <svg
                class="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div
            class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 pb-[10px] pt-2 lg:flex-none"
          >
            <div v-if="tierListViewModel === 'chart'">
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.tierListLegend') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  v-for="entry in TIER_DIVERGING_LEGEND"
                  :key="'tl-chart-tier-' + entry.key"
                  type="button"
                  class="rounded p-0.5 transition-colors"
                  :class="
                    tierListChartTierEnabled(entry.key)
                      ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="
                    entry.key === 'S+'
                      ? t('statisticsPage.tierS+')
                      : entry.key === 'D'
                        ? t('statisticsPage.tierF')
                        : t('statisticsPage.tier' + entry.key)
                  "
                  @click="toggleTierListChartTier(entry.key)"
                >
                  <span
                    class="flex h-3 w-3 min-w-[12px] items-center justify-center rounded-sm text-[13px] font-bold leading-none text-black"
                    :style="{ backgroundColor: entry.color }"
                  >
                    <template v-if="entry.key === 'D'">F</template>
                    <template v-else>{{ entry.key }}</template>
                  </span>
                </button>
              </div>
            </div>
            <div>
              <label for="stats-filter-version-tl" class="mb-1 block text-sm font-medium text-text">
                {{ t('statisticsPage.overviewFilterByVersion') }}
              </label>
              <select
                id="stats-filter-version-tl"
                v-model="statsVersionFilter"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                @change="onStatsFilterChange"
              >
                <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
                <option v-for="v in statsVersionOptions" :key="v.version" :value="v.version">
                  {{ v.version }}
                </option>
              </select>
            </div>
            <div>
              <label
                for="stats-filter-progression-version-tl"
                class="mb-1 block text-sm font-medium text-text"
              >
                {{ t('statisticsPage.progressionsReferenceVersion') }}
              </label>
              <select
                id="stats-filter-progression-version-tl"
                v-model="progressionFromVersionModel"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
              >
                <option
                  v-for="v in progressionSelectableVersions"
                  :key="'delta-from-' + v.version"
                  :value="v.version"
                >
                  {{ v.version }}
                </option>
              </select>
            </div>
            <div>
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.overviewMatchesByDivision') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-division-btn rounded p-0.5 transition-colors"
                  :class="
                    statsDivisionFilter.length === 0
                      ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="t('statisticsPage.allRanks')"
                  @click="selectAllDivisions()"
                >
                  <img
                    src="/data/community-dragon/ranked-emblem/Unranked.png"
                    :alt="t('statisticsPage.allRanks')"
                    class="h-3 w-3 object-contain"
                    :class="
                      statsDivisionFilter.length === 0
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
                <button
                  v-for="tier in rankTiers"
                  :key="tier"
                  type="button"
                  class="stats-division-btn rounded p-0.5 transition-colors"
                  :class="
                    statsDivisionFilter.includes(tier)
                      ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                      : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="formatDivisionLabel(tier)"
                  @click="toggleDivisionFilter(tier)"
                >
                  <img
                    v-if="getRankedEmblemUrl(tier)"
                    :src="getRankedEmblemUrl(tier)!"
                    :alt="tier"
                    class="h-3 w-3 object-contain"
                    :class="
                      statsDivisionFilter.includes(tier)
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
              </div>
            </div>
            <div>
              <div class="mb-1 text-sm font-medium text-text">
                {{ t('statisticsPage.filterRole') }}
              </div>
              <div class="flex flex-wrap gap-1">
                <button
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="!statsRoleFilter ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'"
                  :title="t('statisticsPage.allRoles')"
                  @click="selectAllRoles()"
                >
                  <img
                    src="/icons/roles/all-role.png"
                    :alt="t('statisticsPage.allRoles')"
                    class="h-3 w-3 object-contain"
                    :class="
                      !statsRoleFilter ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
                <button
                  v-for="r in roles"
                  :key="r.value"
                  type="button"
                  class="stats-role-btn rounded p-0.5 transition-colors"
                  :class="
                    statsRoleFilter === r.value ? 'bg-blue-500/20' : 'bg-black/20 hover:bg-white/10'
                  "
                  :title="r.label"
                  @click="toggleRoleFilter(r)"
                >
                  <img
                    :src="r.icon"
                    :alt="r.label"
                    class="h-3 w-3 object-contain"
                    :class="
                      statsRoleFilter === r.value
                        ? 'saturate-110 opacity-100'
                        : 'brightness-125 grayscale'
                    "
                    width="12"
                    height="12"
                  />
                </button>
              </div>
            </div>
            <div>
              <label for="otp-filter-tl" class="mb-1 block text-sm font-medium text-text">
                {{ t('statisticsPage.filterOtp') }}
              </label>
              <select
                id="otp-filter-tl"
                v-model="statsOtpFilter"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text"
                @change="onStatsFilterChange"
              >
                <option value="non">{{ t('statisticsPage.filterOtpNo') }}</option>
                <option value="oui">{{ t('statisticsPage.filterOtpYes') }}</option>
                <option value="solo">{{ t('statisticsPage.filterOtpSolo') }}</option>
              </select>
            </div>
            <div>
              <label for="champion-search-tl" class="mb-1 block text-sm font-medium text-text">{{
                t('statisticsPage.searchChampion')
              }}</label>
              <input
                id="champion-search-tl"
                v-model.trim="championSearchQuery"
                type="text"
                :placeholder="t('statisticsPage.searchChampionPlaceholder')"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text placeholder:text-text/50"
              />
            </div>
            <button
              type="button"
              class="mt-2 rounded border border-primary/40 bg-black/20 px-3 py-2 text-sm font-semibold text-text/90 hover:bg-primary/20 lg:hidden"
              @click="closeFilters"
            >
              {{ t('statisticsPage.closeFilters') }}
            </button>
          </div>
        </aside>

        <div
          class="min-w-0 flex-1 p-4 pt-14 lg:px-3 lg:pb-4 lg:pt-0"
          :class="filtersOpen ? 'max-lg:pointer-events-none' : ''"
        >
          <div class="w-full space-y-4">
            <StatisticsTierListTab :show-view-model-toggle="false" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-show="filtersOpen"
      class="fixed inset-0 z-[45] bg-black/50 lg:hidden"
      aria-hidden="true"
      role="presentation"
      @click="closeFilters"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  getCurrentInstance,
  provide,
  unref,
  isRef,
  defineAsyncComponent,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { RANK_TIERS } from '~/utils/rankTiers'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { apiUrl } from '~/utils/apiUrl'
import { useStatisticsTierListPage } from '~/composables/statistics/useStatisticsTierListPage'

definePageMeta({
  layout: 'default',
})

const StatisticsTierListTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsTierListTab.vue')
)

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()
const statisticsUiStore = useStatisticsUiStore()
const { version: gameVersion } = useGameVersion()

useHead({
  title: () => t('statisticsPage.tabTierList'),
  meta: [{ name: 'description', content: () => t('statisticsPage.metaDescription') }],
})

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

function queryFirst(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function queryAll(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter(Boolean)
  return value ? [value] : []
}

function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split('.').map(x => Number(x))
  const pb = b.split('.').map(x => Number(x))
  const maxLen = Math.max(pa.length, pb.length)
  for (let i = 0; i < maxLen; i++) {
    const da = Number.isFinite(pa[i]!) ? (pa[i] as number) : 0
    const db = Number.isFinite(pb[i]!) ? (pb[i] as number) : 0
    if (da !== db) return db - da
  }
  return b.localeCompare(a)
}

const statsKnownVersions = ref<Array<{ version: string; matchCount: number }>>([])

function mergeKnownVersions(
  rows: Array<{ version: string; matchCount: number }> | null | undefined
): void {
  if (!rows?.length) return
  const byVersion = new Map<string, number>(
    statsKnownVersions.value.map(v => [v.version, v.matchCount])
  )
  for (const row of rows) {
    if (!row?.version) continue
    const prev = byVersion.get(row.version) ?? 0
    byVersion.set(row.version, Math.max(prev, Number(row.matchCount) || 0))
  }
  statsKnownVersions.value = Array.from(byVersion.entries())
    .map(([version, matchCount]) => ({ version, matchCount }))
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
}

function statsFetch<T = unknown>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
  return $fetch(url, { ...options }) as Promise<T>
}

async function loadKnownVersionsFromGameData(): Promise<void> {
  try {
    const data = await statsFetch<{
      versions?: Array<{ version?: string; patchLabel?: string }>
    }>(apiUrl('/api/game-data/versions'))
    const rows =
      data?.versions
        ?.map(v => {
          const version = String(v.patchLabel ?? v.version ?? '').trim()
          return version ? { version, matchCount: 0 } : null
        })
        .filter((v): v is { version: string; matchCount: number } => v != null) ?? []
    mergeKnownVersions(rows)
  } catch {
    /* ignore */
  }
}

async function loadOverviewVersionsCatalog() {
  await loadKnownVersionsFromGameData()
  const params = new URLSearchParams()
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  params.set('otp', statsOtpFilter.value)
  const q = params.toString() ? `?${params.toString()}` : ''
  try {
    const data = await statsFetch<{
      matchesByVersion?: Array<{ version: string; matchCount: number }>
    }>(apiUrl('/api/stats/overview' + q))
    mergeKnownVersions(data?.matchesByVersion)
  } catch {
    /* ignore */
  }
}

const statsVersionOptions = computed(() => statsKnownVersions.value)

const statsVersionFilter = ref('')
const statsDivisionFilter = ref<string[]>([])
const statsRoleFilter = ref('')
const statsOtpFilter = ref<'oui' | 'non' | 'solo'>('non')
const championSearchQuery = ref('')
const championsPageSize = ref(20)
const progressionFromVersionOverride = ref('')
const isApplyingQueryState = ref(false)
const isSyncingQueryState = ref(false)

function normalizeVersionToPrefix(v: string | null | undefined): string | null {
  if (!v || typeof v !== 'string') return null
  const parts = v.trim().split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return parts[0] || null
}

function syncProgressionDeltaToVersionBeforeFilter(): boolean {
  const filter = statsVersionFilter.value.trim()
  const list = statsVersionOptions.value
  const before = progressionFromVersionOverride.value
  if (!filter) {
    if (before !== '') {
      progressionFromVersionOverride.value = ''
      return true
    }
    return false
  }
  const idx = list.findIndex(v => v.version === filter)
  if (idx < 0) return false
  const prev = list[idx + 1]?.version ?? ''
  if (before === prev) return false
  progressionFromVersionOverride.value = prev
  return true
}

const progressionFromVersion = computed(() => {
  if (progressionFromVersionOverride.value) return progressionFromVersionOverride.value
  const versions = statsVersionOptions.value
  if (versions.length >= 2) return versions[1]?.version ?? null
  if (versions.length === 1) return versions[0]?.version ?? null
  return normalizeVersionToPrefix(versionStore.currentVersion)
})

const progressionSelectableVersions = computed(() => {
  const versions = statsVersionOptions.value
  if (!statsVersionFilter.value) return versions
  const filtered = versions.filter(v => v.version !== statsVersionFilter.value)
  return filtered.length > 0 ? filtered : versions
})

const progressionFromVersionModel = computed({
  get: () => progressionFromVersion.value ?? '',
  set: (value: string) => {
    progressionFromVersionOverride.value = value || ''
  },
})

if (import.meta.client) {
  watch(statsVersionFilter, () => {
    syncProgressionDeltaToVersionBeforeFilter()
  })
  watch(
    () => statsVersionOptions.value.map(v => v.version).join('\n'),
    () => {
      if (!statsVersionFilter.value) return
      if (progressionFromVersionOverride.value !== '') return
      syncProgressionDeltaToVersionBeforeFilter()
    }
  )
}

function applyDefaultVersionFiltersFromKnownVersions(): boolean {
  const versions = statsVersionOptions.value
  if (!versions.length) return false
  let changed = false
  if (!statsVersionFilter.value) {
    statsVersionFilter.value = versions[0]?.version ?? ''
    changed = true
  }
  const progChanged = syncProgressionDeltaToVersionBeforeFilter()
  return changed || progChanged
}

const rankTiers = [...RANK_TIERS]
const roles = [
  { value: 'TOP', label: 'Top', icon: '/icons/roles/top.png' },
  { value: 'JUNGLE', label: 'Jungle', icon: '/icons/roles/jungle.png' },
  { value: 'MIDDLE', label: 'Mid', icon: '/icons/roles/mid.png' },
  { value: 'BOTTOM', label: 'ADC', icon: '/icons/roles/bot.png' },
  { value: 'SUPPORT', label: 'Support', icon: '/icons/roles/support.png' },
] as const

function formatDivisionLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()
}

function toggleRoleFilter(r: (typeof roles)[number]) {
  statsRoleFilter.value = statsRoleFilter.value === r.value ? '' : r.value
  onStatsFilterChange()
}

function selectAllRoles() {
  statsRoleFilter.value = ''
  onStatsFilterChange()
}

function toggleDivisionFilter(tier: string) {
  const arr = statsDivisionFilter.value
  const idx = arr.indexOf(tier)
  if (idx >= 0) {
    statsDivisionFilter.value = arr.filter((_, i) => i !== idx)
  } else {
    statsDivisionFilter.value = [...arr, tier]
  }
  onStatsFilterChange()
}

function selectAllDivisions() {
  statsDivisionFilter.value = []
  onStatsFilterChange()
}

const tierList = useStatisticsTierListPage({
  statsVersionFilter,
  statsDivisionFilter,
  statsRoleFilter,
  statsOtpFilter,
  championSearchQuery,
  championsPageSize,
  progressionFromVersion,
  gameVersion,
  statsFetch,
})

const {
  tierListViewModel,
  setTierListViewModel,
  tierListChartHeading,
  TIER_DIVERGING_LEGEND,
  toggleTierListChartTier,
  tierListChartTierEnabled,
} = tierList

function onStatsFilterChange() {
  tierList.loadTierList().catch(() => undefined)
  if (statsVersionOptions.value.length <= 1) {
    loadOverviewVersionsCatalog().catch(() => undefined)
  }
}

function resetStatsFilters() {
  statsVersionFilter.value = ''
  statsDivisionFilter.value = []
  statsRoleFilter.value = ''
  statsOtpFilter.value = 'non'
  progressionFromVersionOverride.value = ''
  championSearchQuery.value = ''
  onStatsFilterChange()
}

const filtersOpen = computed({
  get: () => statisticsUiStore.filtersOpen,
  set: value => statisticsUiStore.setFiltersOpen(value),
})

function closeFilters() {
  filtersOpen.value = false
}
function toggleFiltersOpen() {
  filtersOpen.value = !filtersOpen.value
}

function applyTierListStateFromQuery(): void {
  const versionRaw = queryFirst(route.query.version as string | string[] | null | undefined)
  const roleRaw = queryFirst(route.query.role as string | string[] | null | undefined).toUpperCase()
  const otpRaw = queryFirst(route.query.otp as string | string[] | null | undefined)
  const divisionsRaw = queryAll(route.query.rankTier as string | string[] | null | undefined)
    .map(v => v.toUpperCase())
    .filter(Boolean)
  const sortRaw = queryFirst(route.query.sort as string | string[] | null | undefined)
  const viewRaw = queryFirst(route.query.view as string | string[] | null | undefined).toLowerCase()

  isApplyingQueryState.value = true
  statsVersionFilter.value = versionRaw
  statsRoleFilter.value = roleRaw
  statsDivisionFilter.value = divisionsRaw
  statsOtpFilter.value = otpRaw === 'oui' || otpRaw === 'solo' || otpRaw === 'non' ? otpRaw : 'non'
  if (sortRaw === 'winrate' || sortRaw === 'pickrate') {
    tierList.tierListSortColumn.value = sortRaw
    tierList.tierListSortDir.value = 'desc'
    tierList.tierListViewModel.value = 'table'
  } else if (viewRaw === 'chart') {
    tierList.tierListViewModel.value = 'chart'
  } else if (viewRaw === 'table') {
    tierList.tierListViewModel.value = 'table'
  }
  isApplyingQueryState.value = false
  if (import.meta.client) {
    syncProgressionDeltaToVersionBeforeFilter()
  }
}

function syncTierListStateToQuery(): void {
  if (!import.meta.client) return
  if (isApplyingQueryState.value) return
  const nextQuery = { ...route.query } as Record<string, string | string[]>

  if (statsVersionFilter.value) nextQuery.version = statsVersionFilter.value
  else delete nextQuery.version

  if (statsRoleFilter.value) nextQuery.role = statsRoleFilter.value
  else delete nextQuery.role

  if (statsOtpFilter.value !== 'non') nextQuery.otp = statsOtpFilter.value
  else delete nextQuery.otp

  if (statsDivisionFilter.value.length > 0) nextQuery.rankTier = [...statsDivisionFilter.value]
  else delete nextQuery.rankTier

  const sortCol = tierList.tierListSortColumn.value
  if (sortCol === 'winrate' || sortCol === 'pickrate') nextQuery.sort = sortCol
  else delete nextQuery.sort

  if (tierList.tierListViewModel.value === 'chart') nextQuery.view = 'chart'
  else delete nextQuery.view

  isSyncingQueryState.value = true
  router.replace({ path: route.path, query: nextQuery }).finally(() => {
    isSyncingQueryState.value = false
  })
}

watch(
  () => route.query,
  () => {
    if (!import.meta.client) return
    if (isSyncingQueryState.value) return
    applyTierListStateFromQuery()
  }
)

watch(
  [
    statsVersionFilter,
    statsDivisionFilter,
    statsRoleFilter,
    statsOtpFilter,
    () => tierList.tierListSortColumn.value,
    () => tierList.tierListSortDir.value,
    () => tierList.tierListViewModel.value,
  ],
  () => {
    syncTierListStateToQuery()
  }
)

onMounted(async () => {
  if (import.meta.client) {
    statisticsUiStore.init()
  }
  applyTierListStateFromQuery()
  if (!versionStore.currentVersion) {
    await versionStore.loadCurrentVersion()
  }
  await loadKnownVersionsFromGameData()
  applyDefaultVersionFiltersFromKnownVersions()
  await tierList.loadTierList()
  championsStore.loadChampions(riotLocale.value)
})

const __vm = getCurrentInstance()
if (__vm?.proxy) {
  const __ctx = new Proxy(
    {},
    {
      get(_target, key: string | symbol) {
        if (key === 't') return t
        if (typeof key !== 'string') {
          return unref((__vm.proxy as Record<string, unknown>)[key as string])
        }
        if (key in tierList) {
          const v = tierList[key as keyof typeof tierList]
          return unref(v as never)
        }
        const inst = __vm as { setupState?: Record<string, unknown> }
        const setupState = inst.setupState
        if (setupState && key in setupState) {
          return unref(setupState[key] as never)
        }
        return unref((__vm.proxy as Record<string, unknown>)[key])
      },
      set(_target, key: string | symbol, value: unknown) {
        if (typeof key === 'string') {
          if (key in tierList) {
            const v = tierList[key as keyof typeof tierList]
            if (isRef(v)) {
              ;(v as { value: unknown }).value = value
              return true
            }
          }
          const inst = __vm as { setupState?: Record<string, unknown> }
          const binding = inst.setupState?.[key]
          if (isRef(binding)) {
            ;(binding as { value: unknown }).value = value
            return true
          }
        }
        ;(__vm.proxy as Record<string, unknown>)[key as string] = value
        return true
      },
    }
  )
  provide('statisticsPageCtx', __ctx)
}
</script>
