<template>
  <div class="statistics flex min-h-screen min-w-0 flex-col overflow-x-hidden text-text">
    <div
      class="statistics-tabs-bar flex w-full min-w-0 flex-shrink-0 items-start gap-2 overflow-x-hidden bg-surface/30 px-4 pb-2 pt-4"
    >
      <div class="statistics-tabs-scroll-wrap relative min-w-0 flex-1 overflow-hidden">
        <div
          ref="tierListTabsNavEl"
          class="statistics-tabs-nav flex flex-nowrap gap-1 overflow-x-auto border-b border-primary/30 pb-2"
        >
          <button
            type="button"
            :class="[
              'statistics-tab-btn shrink-0 snap-start whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors',
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
              'statistics-tab-btn shrink-0 snap-start whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors',
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
              'statistics-tab-btn shrink-0 snap-start whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors',
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
              'statistics-tab-btn shrink-0 snap-start whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors',
              tierListViewModel === 'botlaneDuoRank'
                ? 'border border-accent/50 bg-accent/20 text-accent'
                : 'border border-transparent text-text/80 hover:bg-primary/10 hover:text-text',
            ]"
            @click="setTierListMainView('botlaneDuoRank')"
          >
            {{ t('statisticsPage.tierListViewBotlaneDuoRank') }}
          </button>
        </div>
      </div>
      <h2
        v-if="tierListViewModel === 'chart'"
        class="mt-0.5 min-w-0 max-w-[42%] shrink-0 truncate text-right text-[11px] font-bold uppercase tracking-tight text-text-accent sm:max-w-[min(100%,36rem)] sm:text-xs md:max-w-none md:text-sm"
      >
        {{ tierListChartHeading }}
      </h2>
    </div>

    <div class="flex min-h-0 min-w-0 flex-1">
      <button
        v-if="showDesktopFiltersTrigger"
        type="button"
        class="statistics-filters-desktop-trigger hidden shrink-0 touch-manipulation lg:sticky lg:top-4 lg:z-20 lg:mr-2 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:self-start"
        :aria-label="
          filtersOpen ? t('statisticsPage.closeFilters') : t('statisticsPage.openFilters')
        "
        :aria-expanded="filtersOpen"
        @click="toggleFiltersOpen"
      >
        <span class="filters-collapse-floating inline-flex" aria-hidden="true">
          <svg
            class="h-2 w-2 transition-transform duration-200"
            :class="filtersOpen ? 'rotate-180' : ''"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </span>
        <span
          class="max-w-[4.5rem] text-center text-[10px] font-semibold leading-tight text-text/85"
        >
          {{ t('statisticsPage.filtersTitle') }}
        </span>
        <span
          v-if="activeStatsFiltersCount > 0"
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
          :aria-label="`${activeStatsFiltersCount} ${t('statisticsPage.filtersTitle')}`"
        >
          {{ activeStatsFiltersCount }}
        </span>
      </button>

      <div
        v-if="filtersOpen && effectiveFiltersSheetMode"
        class="fixed inset-0 z-[10050] bg-black/50"
        aria-hidden="true"
        role="presentation"
        @click="closeFilters"
      />

      <aside
        v-show="filtersOpen || !effectiveFiltersSheetMode"
        :class="[
          'statistics-filters-panel flex shrink-0 flex-col overflow-hidden bg-surface',
          effectiveFiltersSheetMode
            ? 'fixed inset-x-0 bottom-0 top-auto z-[10051] max-h-[85vh] w-full rounded-t-2xl shadow-lg'
            : [
                'hidden w-0 opacity-0 transition-[width,opacity] duration-200',
                'lg:sticky lg:top-4 lg:z-0 lg:flex lg:h-auto lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:rounded-lg lg:shadow-none',
                filtersOpen ? 'lg:w-64 lg:opacity-100' : 'lg:w-0 lg:opacity-0',
              ],
        ]"
        :role="effectiveFiltersSheetMode ? 'dialog' : undefined"
        :aria-modal="effectiveFiltersSheetMode ? true : undefined"
        :aria-label="t('statisticsPage.filtersTitle')"
        @click.stop
      >
        <div
          class="relative z-[1] flex shrink-0 items-center gap-2 border-b border-primary/25 p-2 lg:border-transparent lg:pb-2"
        >
          <button
            type="button"
            :class="[
              'mx-auto mb-1 flex h-6 w-14 shrink-0 touch-manipulation items-center justify-center rounded-full',
              effectiveFiltersSheetMode ? '' : 'lg:hidden',
            ]"
            :aria-label="t('statisticsPage.closeFilters')"
            @click="closeFilters"
          >
            <span class="h-1 w-10 rounded-full bg-primary/40" aria-hidden="true" />
          </button>
          <h2 class="min-w-0 flex-1 truncate text-lg font-semibold text-text-accent">
            {{ t('statisticsPage.filtersTitle') }}
          </h2>
          <button
            type="button"
            class="statistics-filters-reset inline-flex shrink-0 touch-manipulation items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-500/15 hover:text-blue-200"
            @click="resetStatsFilters"
          >
            <span class="iconify i-mdi:refresh" aria-hidden="true" />
            Reset
          </button>
        </div>
        <div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 lg:flex-none">
          <div class="statistics-filters-fields flex flex-col gap-3">
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
                  :aria-pressed="statsDivisionFilter.length === 0"
                  @mousedown.prevent
                  @click.stop="selectAllDivisions()"
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
                  :aria-pressed="statsDivisionFilter.includes(tier)"
                  @mousedown.prevent
                  @click.stop="toggleDivisionFilter(tier)"
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
          </div>
        </div>
        <div class="shrink-0 border-t border-primary/25 p-3 lg:hidden">
          <button
            type="button"
            class="w-full touch-manipulation rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-text hover:bg-primary/20"
            @click="closeFilters"
          >
            {{ t('statisticsPage.closeFilters') }}
          </button>
        </div>
      </aside>

      <div class="min-w-0 flex-1 p-4 max-lg:pb-20 lg:px-3 lg:pb-4 lg:pt-0">
        <div class="w-full space-y-4">
          <section
            v-if="tierListSeoRows.length > 0"
            class="tier-list-seo-summary rounded-lg border border-primary/20 bg-surface/20 p-3 text-sm text-text/85"
            aria-label="Résumé tier list"
          >
            <h1 class="text-lg font-bold text-accent">{{ tierListSeoTitle }}</h1>
            <ul class="mt-2 space-y-1">
              <li
                v-for="row in tierListSeoRows"
                :key="'tl-seo-' + row.championId"
                class="tabular-nums"
              >
                {{ row.name }} — {{ row.tier }} — {{ row.winrate }}% WR — {{ row.pickrate }}% PR
              </li>
            </ul>
          </section>
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

    <button
      v-if="!filtersOpen"
      type="button"
      :class="[
        'statistics-filters-fab fixed bottom-4 left-1/2 z-[58] -translate-x-1/2 items-center gap-2 rounded-full border border-primary/40 bg-surface/95 px-4 py-2.5 text-sm font-semibold text-text shadow-lg backdrop-blur-sm',
        filtersFabClass,
      ]"
      :aria-label="t('statisticsPage.openFilters')"
      @click="openFilters"
    >
      {{ t('statisticsPage.filtersTitle') }}
      <span
        v-if="activeStatsFiltersCount > 0"
        class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-background"
      >
        {{ activeStatsFiltersCount }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  getCurrentInstance,
  provide,
  unref,
  isRef,
} from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import StatisticsTierListTab from '~/components/statistics/tabs/StatisticsTierListTab.vue'
import { RANK_TIERS } from '~/utils/rankTiers'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'
import { apiUrl } from '~/utils/apiUrl'
import { useStatisticsTierListPage } from '~/composables/statistics/useStatisticsTierListPage'
import {
  enrichBotlaneRowsWithPatchDeltas,
  type BotlaneTierRowWithPatchDelta,
} from '~/composables/statistics/botlanePatchDeltas'
import { useChampionNames } from '~/composables/useChampionNames'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { absoluteSitePath, pageOgImageUrl } from '~/utils/siteUrl'
import { useOgMetaTags } from '~/composables/useOgMetaTags'
import { championStatsDetailPath } from '~/utils/championStatsRoutes'
import { parseRankTierQuery, rankTierSelectionsEqual } from '~/utils/statisticsRankTierQuery'
import StatisticsBotlaneMatchupsTierTab from '~/components/statistics/tabs/StatisticsBotlaneMatchupsTierTab.vue'
import StatisticsVsBotlaneTab from '~/components/statistics/tabs/StatisticsVsBotlaneTab.vue'

definePageMeta({
  layout: 'default',
})

const BOTLANE_STATS_TIMEOUT_MS = 60_000

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()
const statisticsUiStore = useStatisticsUiStore()
const { filtersOpen } = storeToRefs(statisticsUiStore)
const { effectiveFiltersSheetMode, showDesktopFiltersTrigger, filtersFabClass } =
  useStatisticsFiltersSheetMode()
const { version: gameVersion } = useGameVersion()
const tierListTabsNavEl = ref<HTMLElement | null>(null)
useHorizontalScrollContainer(tierListTabsNavEl)

const { data: championNames } = await useChampionNames()

const tierListSeoTitle = computed(() =>
  t('statisticsPage.tierListMetaTitle', {
    season: lolSeasonFromGameVersion(gameVersion.value),
    patch: gameVersion.value,
  })
)
const tierListSeoDescription = computed(() =>
  t('statisticsPage.tierListMetaDescription', {
    season: lolSeasonFromGameVersion(gameVersion.value),
    patch: gameVersion.value,
  })
)
const tierListSiteUrl = useSiteUrl()
const tierListOgImage = computed(() => pageOgImageUrl(tierListSiteUrl, 'tier-list'))
useSeoMeta({
  title: tierListSeoTitle,
  description: tierListSeoDescription,
  ogTitle: tierListSeoTitle,
  ogImage: tierListOgImage,
  twitterImage: tierListOgImage,
  twitterCard: 'summary_large_image',
})
useOgMetaTags({
  title: tierListSeoTitle,
  description: tierListSeoDescription,
  image: tierListOgImage,
  url: computed(() => absoluteSitePath(tierListSiteUrl, '/statistics/tier-list')),
})

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

function queryFirst(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
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

const activeStatsFiltersCount = computed(() => {
  let count = 0
  if (statsVersionFilter.value) count++
  if (statsDivisionFilter.value.length > 0) count++
  if (statsRoleFilter.value) count++
  if (statsOtpFilter.value !== 'non') count++
  if (progressionFromVersionOverride.value) count++
  if (championSearchQuery.value.trim()) count++
  return count
})

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

const COHORT_DIVISION_DEBOUNCE_MS = 280
let cohortDivisionEffectTimer: ReturnType<typeof setTimeout> | null = null

function scheduleDivisionCohortEffects() {
  if (!import.meta.client) return
  if (cohortDivisionEffectTimer) clearTimeout(cohortDivisionEffectTimer)
  cohortDivisionEffectTimer = setTimeout(() => {
    cohortDivisionEffectTimer = null
    onStatsFilterChange()
    if (!isApplyingQueryState.value && !isSyncingQueryState.value) {
      syncTierListStateToQuery()
    }
  }, COHORT_DIVISION_DEBOUNCE_MS)
}

function toggleDivisionFilter(tier: string) {
  const arr = statsDivisionFilter.value
  const idx = arr.indexOf(tier)
  if (idx >= 0) {
    statsDivisionFilter.value = arr.filter((_, i) => i !== idx)
  } else {
    statsDivisionFilter.value = [...arr, tier]
  }
}

function selectAllDivisions() {
  if (statsDivisionFilter.value.length === 0) return
  statsDivisionFilter.value = []
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
  championNames,
})

const {
  tierListViewModel,
  setTierListViewModel,
  tierListChartHeading,
  TIER_DIVERGING_LEGEND,
  toggleTierListChartTier,
  tierListChartTierEnabled,
  championName,
} = tierList

const tierListSeoRows = computed(() => {
  const rows = tierList.tierListData.value?.rows ?? []
  return rows.slice(0, 50).map(row => ({
    championId: row.championId,
    name: championName(row.championId) ?? String(row.championId),
    tier: row.tier,
    winrate: Number(row.winrate).toFixed(1),
    pickrate: Number(row.pickrate).toFixed(1),
  }))
})

const tierListSiteUrlForJsonLd = useSiteUrl()
useJsonLdHead(
  'tier-list',
  computed(() => {
    const rows = tierList.tierListData.value?.rows ?? []
    if (rows.length === 0) return null
    return itemListJsonLd(tierListSiteUrlForJsonLd, {
      name: t('statisticsPage.tabTierList'),
      description: t('statisticsPage.metaDescription'),
      path: '/statistics/tier-list',
      items: rows.slice(0, 30).map((row, index) => ({
        name: championName(row.championId) ?? `Champion ${row.championId}`,
        url: championStatsDetailPath(row.championId, p => p, championsStore.champions),
        position: index + 1,
      })),
    })
  })
)

type BotlaneTierPayload = {
  version: string | null
  rankTier: string | string[] | null
  rows: BotlaneTierRowWithPatchDelta[]
} | null

const botlanePatchDeltaRefLabel = computed(() => {
  const ref = normalizeVersionToPrefix(progressionFromVersion.value)
  const main = normalizeVersionToPrefix(statsVersionFilter.value)
  if (!ref || !main || ref === main) return null
  return ref
})

function fetchBotlanePayload(
  version: string,
  endpoint: '/api/stats/botlane-vs-botlane' | '/api/stats/botlane-duo-tierlist'
): Promise<BotlaneTierPayload> {
  const params = new URLSearchParams()
  params.set('version', version)
  for (const t of statsDivisionFilter.value) params.append('rankTier', t)
  params.set('otp', statsOtpFilter.value)
  const q = params.toString() ? `?${params.toString()}` : ''
  const fetchOpts = {
    timeout: BOTLANE_STATS_TIMEOUT_MS,
    cache: 'no-store' as const,
    headers: { 'cache-control': 'no-cache' },
  }
  return statsFetch<BotlaneTierPayload>(apiUrl(endpoint + q), fetchOpts)
}

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

  const refPatch = botlanePatchDeltaRefLabel.value
  const mode = vm === 'botlaneMatchups' ? 'vs' : 'duo'
  const endpoint =
    vm === 'botlaneMatchups' ? '/api/stats/botlane-vs-botlane' : '/api/stats/botlane-duo-tierlist'

  if (vm === 'botlaneMatchups') {
    botlaneRankingPending.value = false
    botlaneVsPending.value = true
    botlaneVsError.value = false
    try {
      const data = await fetchBotlanePayload(version, endpoint)
      let rows: BotlaneTierRowWithPatchDelta[] = data?.rows ?? []
      if (refPatch && rows.length > 0) {
        try {
          const refData = await fetchBotlanePayload(refPatch, endpoint)
          if (refData?.rows?.length) {
            rows = enrichBotlaneRowsWithPatchDeltas(rows, refData.rows, mode)
          }
        } catch {
          /* patch de référence optionnel */
        }
      }
      botlaneVsData.value = data ? { ...data, rows } : null
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
      const data = await fetchBotlanePayload(version, endpoint)
      let rows: BotlaneTierRowWithPatchDelta[] = data?.rows ?? []
      if (refPatch && rows.length > 0) {
        try {
          const refData = await fetchBotlanePayload(refPatch, endpoint)
          if (refData?.rows?.length) {
            rows = enrichBotlaneRowsWithPatchDeltas(rows, refData.rows, mode)
          }
        } catch {
          /* patch de référence optionnel */
        }
      }
      botlaneRankingData.value = data ? { ...data, rows } : null
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
  if (cohortDivisionEffectTimer) {
    clearTimeout(cohortDivisionEffectTimer)
    cohortDivisionEffectTimer = null
  }
  statsVersionFilter.value = ''
  statsDivisionFilter.value = []
  statsRoleFilter.value = ''
  statsOtpFilter.value = 'non'
  progressionFromVersionOverride.value = ''
  championSearchQuery.value = ''
  onStatsFilterChange()
}

function closeFilters() {
  statisticsUiStore.setFiltersOpen(false)
}
function openFilters() {
  statisticsUiStore.setFiltersOpen(true)
}
function toggleFiltersOpen() {
  if (filtersOpen.value) closeFilters()
  else openFilters()
}

function onFiltersEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !filtersOpen.value) return
  if (!import.meta.client || !effectiveFiltersSheetMode.value) return
  closeFilters()
}

watch([filtersOpen, effectiveFiltersSheetMode], () => {
  if (!import.meta.client) return
  const lock = effectiveFiltersSheetMode.value && filtersOpen.value
  document.body.style.overflow = lock ? 'hidden' : ''
})

function applyTierListStateFromQuery(): void {
  if (isSyncingQueryState.value) return
  const versionRaw = queryFirst(route.query.version as string | string[] | null | undefined)
  const roleRaw = queryFirst(route.query.role as string | string[] | null | undefined).toUpperCase()
  const otpRaw = queryFirst(route.query.otp as string | string[] | null | undefined)
  const divisionsRaw = parseRankTierQuery(
    route.query.rankTier as string | string[] | null | undefined
  )
  const sortRaw = queryFirst(route.query.sort as string | string[] | null | undefined)
  const viewRaw = queryFirst(route.query.view as string | string[] | null | undefined).toLowerCase()

  isApplyingQueryState.value = true
  statsVersionFilter.value = versionRaw
  statsRoleFilter.value = roleRaw
  if (!rankTierSelectionsEqual(statsDivisionFilter.value, divisionsRaw)) {
    statsDivisionFilter.value = divisionsRaw
  }
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
    statsRoleFilter,
    statsOtpFilter,
    progressionFromVersion,
    () => tierList.tierListSortColumn.value,
    () => tierList.tierListSortDir.value,
    () => tierList.tierListViewModel.value,
  ],
  () => {
    syncTierListStateToQuery()
  }
)

watch(
  statsDivisionFilter,
  () => {
    if (isApplyingQueryState.value) return
    scheduleDivisionCohortEffects()
  },
  { deep: true }
)

watch([progressionFromVersion, statsVersionFilter, statsRoleFilter, statsOtpFilter], () => {
  if (isBotlaneTierListView(tierListViewModel.value)) {
    loadActiveBotlanePanel().catch(() => undefined)
  }
})

watch(
  () => tierListViewModel.value,
  (v, prev) => {
    if (isBotlaneTierListView(prev) && !isBotlaneTierListView(v)) {
      tierList.loadTierList().catch(() => undefined)
    }
  }
)

async function bootstrapTierListPage(): Promise<number> {
  if (import.meta.server) {
    applyTierListStateFromQuery()
  }
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
  await championsStore.loadChampions(riotLocale.value)
  return tierList.tierListData.value?.rows?.length ?? 0
}

/** Filtres API uniquement — pas la vue ni l’URL complète (évite de réappliquer ?view=chart après un clic onglet). */
const tierListBootstrapKey = computed(() =>
  [
    riotLocale.value,
    statsVersionFilter.value,
    statsDivisionFilter.value.join(','),
    statsRoleFilter.value,
    statsOtpFilter.value,
    progressionFromVersion.value,
  ].join('|')
)

await useAsyncData(
  () => `tier-list-bootstrap-${tierListBootstrapKey.value}`,
  bootstrapTierListPage,
  { watch: [tierListBootstrapKey] }
)

onMounted(() => {
  if (import.meta.client) {
    statisticsUiStore.init()
    document.addEventListener('keydown', onFiltersEscapeKey)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onFiltersEscapeKey)
  if (import.meta.client) document.body.style.overflow = ''
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

<style>
/* width/overflow scroll rules in app.vue */
.statistics-tabs-scroll-wrap::before,
.statistics-tabs-scroll-wrap::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 8px;
  width: 28px;
  z-index: 2;
  pointer-events: none;
}
.statistics-tabs-scroll-wrap::before {
  left: 0;
  background: linear-gradient(to right, rgb(8 16 31 / 0.95), transparent);
}
.statistics-tabs-scroll-wrap::after {
  right: 0;
  background: linear-gradient(to left, rgb(8 16 31 / 0.95), transparent);
}
@media (max-width: 767px) {
  .statistics .statistics-tab-btn {
    font-size: 13px;
    padding-left: 12px;
    padding-right: 12px;
  }
}
@media (max-width: 1023px) {
  .statistics-filters-panel .flex.min-h-0.flex-1 {
    overflow-y: auto;
  }
}

.statistics .statistics-champion-detail-link {
  touch-action: manipulation;
  -webkit-tap-highlight-color: rgb(var(--rgb-accent) / 0.2);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  position: relative;
  z-index: 2;
}
.statistics .statistics-champion-stats-mobile-identity .statistics-champion-detail-link {
  min-height: 2.75rem;
  min-width: 2.75rem;
}
.statistics .statistics-champion-detail-link :is(img, .champion-portrait, .champion-portrait *) {
  pointer-events: none;
}
</style>
