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
            @click="setTierListMainView('table')"
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
            @click="setTierListMainView('chart')"
          >
            {{ t('statisticsPage.tierListViewChart') }}
          </button>
          <button
            type="button"
            :class="[
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tierListViewModel === 'botlaneMatchups'
                ? 'border border-accent/50 bg-accent/20 text-accent'
                : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
            ]"
            @click="setTierListMainView('botlaneMatchups')"
          >
            {{ t('statisticsPage.tierListViewBotlaneMatchups') }}
          </button>
          <button
            type="button"
            :class="[
              'rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tierListViewModel === 'botlaneDuoRank'
                ? 'border border-accent/50 bg-accent/20 text-accent'
                : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
            ]"
            @click="setTierListMainView('botlaneDuoRank')"
          >
            {{ t('statisticsPage.tierListViewBotlaneDuoRank') }}
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
            <div
              v-if="
                tierListViewModel !== 'botlaneMatchups' && tierListViewModel !== 'botlaneDuoRank'
              "
            >
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
            <StatisticsTierListTab
              v-show="
                tierListViewModel !== 'botlaneMatchups' && tierListViewModel !== 'botlaneDuoRank'
              "
              :show-view-model-toggle="false"
            />
            <StatisticsBotlaneMatchupsTierTab
              v-show="tierListViewModel === 'botlaneMatchups'"
              :vs-data="botlaneVsData"
              :vs-pending="botlaneVsPending"
              :vs-error="botlaneVsError"
            />
            <StatisticsVsBotlaneTab
              v-show="tierListViewModel === 'botlaneDuoRank'"
              :ranking-data="botlaneRankingData"
              :ranking-pending="botlaneRankingPending"
              :ranking-error="botlaneRankingError"
            />
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
const StatisticsVsBotlaneTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsVsBotlaneTab.vue')
)
const StatisticsBotlaneMatchupsTierTab = defineAsyncComponent(
  () => import('~/components/statistics/tabs/StatisticsBotlaneMatchupsTierTab.vue')
)

const BOTLANE_STATS_TIMEOUT_MS = 60_000

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
/** Fallback si `statsKnownVersions` est encore vide (même logique que la page stats `/statistics`). */
const tierListOverviewMatchVersions = ref<Array<{ version: string; matchCount: number }>>([])

function setVersionsWithMatches(
  rows: Array<{ version: string; matchCount: number }> | null | undefined
): void {
  if (!rows?.length) return
  const filtered = rows
    .filter(r => r?.version && Number(r.matchCount) > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
  statsKnownVersions.value = filtered
  tierListOverviewMatchVersions.value = filtered
}

function statsFetch<T = unknown>(url: string, options?: Parameters<typeof $fetch>[1]): Promise<T> {
  return $fetch(url, { ...options }) as Promise<T>
}

async function loadVersionsWithMatches(): Promise<void> {
  const params = new URLSearchParams()
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  const q = params.toString()
  try {
    const data = await statsFetch<{
      versions?: Array<{ version: string; matchCount: number }>
    }>(apiUrl('/api/stats/versions-with-matches' + (q ? `?${q}` : '')))
    if (data?.versions?.length) setVersionsWithMatches(data.versions)
  } catch {
    /* ignore */
  }
}

async function loadOverviewVersionsCatalog() {
  await loadVersionsWithMatches()
}

/** Patches avec matchs en base uniquement (`match_outcome_stats`). */
const statsVersionOptions = computed(() => {
  const fromKnown = statsKnownVersions.value.filter(v => Number(v.matchCount) > 0)
  if (fromKnown.length > 0) return fromKnown
  return [...tierListOverviewMatchVersions.value]
    .filter(v => Number(v.matchCount) > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
})

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
  const versions = statsVersionOptions.value.filter(v => Number(v.matchCount) > 0)
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
    const withData = versions.find(v => Number(v.matchCount ?? 0) > 0)
    statsVersionFilter.value = withData?.version ?? versions[0]?.version ?? ''
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

type BotlaneTierPayload = {
  version: string | null
  rankTier: string | string[] | null
  rows: Array<{
    rank: number
    adcId: number
    supportId: number
    oppAdcId: number
    oppSupportId: number
    games: number
    wins: number
    winrate: number
    deltaVsPeersPp: number | null
    note: number
    tier: string
  }>
} | null

function isBotlaneTierListView(vm: string): boolean {
  return vm === 'botlaneMatchups' || vm === 'botlaneDuoRank'
}

const botlaneVsData = ref<BotlaneTierPayload>(null)
const botlaneRankingData = ref<BotlaneTierPayload>(null)
const botlaneVsPending = ref(false)
const botlaneRankingPending = ref(false)
const botlaneVsError = ref(false)
const botlaneRankingError = ref(false)

async function loadActiveBotlanePanel(): Promise<void> {
  const vm = tierListViewModel.value
  if (!isBotlaneTierListView(vm)) return

  const version = statsVersionFilter.value.trim()
  if (!version) {
    botlaneVsData.value = null
    botlaneRankingData.value = null
    botlaneVsPending.value = false
    botlaneRankingPending.value = false
    botlaneVsError.value = false
    botlaneRankingError.value = false
    return
  }

  const params = new URLSearchParams()
  params.set('version', version)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  const q = params.toString() ? `?${params.toString()}` : ''
  const fetchOpts = {
    timeout: BOTLANE_STATS_TIMEOUT_MS,
    cache: 'no-store' as const,
    headers: { 'cache-control': 'no-cache' },
  }

  if (vm === 'botlaneMatchups') {
    botlaneRankingPending.value = false
    botlaneVsPending.value = true
    botlaneVsError.value = false
    try {
      botlaneVsData.value = await statsFetch<BotlaneTierPayload>(
        apiUrl('/api/stats/botlane-vs-botlane' + q),
        fetchOpts
      )
      botlaneVsError.value = false
    } catch {
      botlaneVsData.value = null
      botlaneVsError.value = true
    } finally {
      botlaneVsPending.value = false
    }
  } else {
    botlaneVsPending.value = false
    botlaneRankingPending.value = true
    botlaneRankingError.value = false
    try {
      botlaneRankingData.value = await statsFetch<BotlaneTierPayload>(
        apiUrl('/api/stats/botlane-duo-tierlist' + q),
        fetchOpts
      )
      botlaneRankingError.value = false
    } catch {
      botlaneRankingData.value = null
      botlaneRankingError.value = true
    } finally {
      botlaneRankingPending.value = false
    }
  }
}

function setTierListMainView(view: 'table' | 'chart' | 'botlaneMatchups' | 'botlaneDuoRank') {
  setTierListViewModel(view)
  if (isBotlaneTierListView(view)) {
    loadActiveBotlanePanel().catch(() => undefined)
  }
}

function onStatsFilterChange() {
  if (!isBotlaneTierListView(tierListViewModel.value)) {
    tierList.loadTierList().catch(() => undefined)
  } else {
    loadActiveBotlanePanel().catch(() => undefined)
  }
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
    .filter(v => Boolean(v) && v !== 'ALL')
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
  } else if (viewRaw === 'botlane-matchups') {
    tierList.tierListViewModel.value = 'botlaneMatchups'
  } else if (viewRaw === 'botlane-duos' || viewRaw === 'botlane-ranking') {
    tierList.tierListViewModel.value = 'botlaneDuoRank'
  } else if (viewRaw === 'botlane') {
    tierList.tierListViewModel.value = 'botlaneDuoRank'
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

  if (tierList.tierListViewModel.value === 'chart') {
    nextQuery.view = 'chart'
    delete nextQuery.botlaneMode
  } else if (tierList.tierListViewModel.value === 'botlaneMatchups') {
    nextQuery.view = 'botlane-matchups'
    delete nextQuery.botlaneMode
  } else if (tierList.tierListViewModel.value === 'botlaneDuoRank') {
    nextQuery.view = 'botlane-duos'
    delete nextQuery.botlaneMode
  } else {
    delete nextQuery.view
    delete nextQuery.botlaneMode
  }

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
    // Même instance de page : changement de query sans clic → recharger l’API botlane active.
    if (isBotlaneTierListView(tierListViewModel.value)) {
      loadActiveBotlanePanel().catch(() => undefined)
    }
  }
)

/** Hydrate filtres / vue depuis l’URL avant les effets async (évite une sync query qui enlève `version` avant le premier fetch botlane). */
if (import.meta.client) {
  applyTierListStateFromQuery()
}

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

watch(
  () => tierListViewModel.value,
  (v, prev) => {
    if (isBotlaneTierListView(prev) && !isBotlaneTierListView(v)) {
      tierList.loadTierList().catch(() => undefined)
    }
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
  await loadVersionsWithMatches()
  await loadOverviewVersionsCatalog()
  applyDefaultVersionFiltersFromKnownVersions()
  if (isBotlaneTierListView(tierListViewModel.value)) {
    await loadActiveBotlanePanel()
  } else {
    await tierList.loadTierList()
  }
  championsStore.loadChampions(riotLocale.value)
})

const __vm = getCurrentInstance()
if (__vm) {
  const __ctx = new Proxy(
    {},
    {
      get(_target, key: string | symbol) {
        if (key === 't') return t
        const proxyObj = __vm.proxy as Record<string, unknown> | null | undefined
        if (typeof key !== 'string') {
          return undefined
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
        return unref(proxyObj?.[key])
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
        const proxyObj = __vm.proxy as Record<string, unknown> | null | undefined
        if (proxyObj && typeof key === 'string') {
          proxyObj[key] = value
        }
        return true
      },
    }
  )
  provide('statisticsPageCtx', __ctx)
}
</script>
