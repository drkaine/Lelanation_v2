<template>
  <div class="statistics flex min-h-screen min-w-0 flex-col overflow-x-hidden text-text">
    <StatisticsFiltersPanel
      :active-filters-count="activeStatsFiltersCount"
      main-class="p-2 max-lg:pb-20 lg:px-2 lg:pb-4 lg:pt-0"
      @reset="resetStatsFilters"
    >
      <div class="statistics-filters-fields flex flex-col gap-3">
        <div>
          <div class="mb-1 text-sm font-medium text-text">
            {{ t('statisticsPage.tierListLegend') }}
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="entry in TIER_DIVERGING_LEGEND"
              :key="'mc-tier-' + entry.key"
              type="button"
              class="rounded p-0.5 transition-colors"
              :class="
                tierListChartTierEnabled(entry.key)
                  ? 'bg-info/20 ring-1 ring-info/60'
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
          <label for="stats-filter-version-mc" class="mb-1 block text-sm font-medium text-text">
            {{ t('statisticsPage.overviewFilterByVersion') }}
          </label>
          <select
            id="stats-filter-version-mc"
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
            for="stats-filter-progression-version-mc"
            class="mb-1 block text-sm font-medium text-text"
          >
            {{ t('statisticsPage.progressionsReferenceVersion') }}
          </label>
          <select
            id="stats-filter-progression-version-mc"
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
                  ? 'bg-info/20 ring-1 ring-info/60'
                  : 'bg-black/20 hover:bg-white/10'
              "
              :title="t('statisticsPage.allRanks')"
              :aria-pressed="statsDivisionFilter.length === 0"
              @mousedown.prevent
              @click.stop="selectAllDivisions()"
            >
              <img
                loading="lazy"
                decoding="async"
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
                  ? 'bg-info/20 ring-1 ring-info/60'
                  : 'bg-black/20 hover:bg-white/10'
              "
              :title="formatDivisionLabel(tier)"
              :aria-pressed="statsDivisionFilter.includes(tier)"
              @mousedown.prevent
              @click.stop="toggleDivisionFilter(tier)"
            >
              <img
                v-if="getRankedEmblemUrl(tier)"
                loading="lazy"
                decoding="async"
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
              :class="!statsRoleFilter ? 'bg-info/20' : 'bg-black/20 hover:bg-white/10'"
              :title="t('statisticsPage.allRoles')"
              @click="selectAllRoles()"
            >
              <img
                src="/icons/roles/all-role.png"
                :alt="t('statisticsPage.allRoles')"
                class="h-3 w-3 object-contain"
                :class="!statsRoleFilter ? 'saturate-110 opacity-100' : 'brightness-125 grayscale'"
                width="12"
                height="12"
              />
            </button>
            <button
              v-for="r in roles"
              :key="r.value"
              type="button"
              class="stats-role-btn rounded p-0.5 transition-colors"
              :class="statsRoleFilter === r.value ? 'bg-info/20' : 'bg-black/20 hover:bg-white/10'"
              :title="r.label"
              @click="toggleRoleFilter(r)"
            >
              <img
                loading="lazy"
                decoding="async"
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
          <label for="otp-filter-mc" class="mb-1 block text-sm font-medium text-text">
            {{ t('statisticsPage.filterOtp') }}
          </label>
          <select
            id="otp-filter-mc"
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
          <label for="champion-search-mc" class="mb-1 block text-sm font-medium text-text">{{
            t('statisticsPage.searchChampion')
          }}</label>
          <input
            id="champion-search-mc"
            v-model.trim="championSearchQuery"
            type="text"
            :placeholder="t('statisticsPage.searchChampionPlaceholder')"
            class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text placeholder:text-text/50"
          />
        </div>
      </div>
      <template #main>
        <StatisticsMetaChartTab />
      </template>
    </StatisticsFiltersPanel>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, provide, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { statsFetch } from '~/utils/statsFetch'
import StatisticsMetaChartTab from '~/components/statistics/tabs/StatisticsMetaChartTab.vue'
import { RANK_TIERS } from '~/utils/rankTiers'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { lolSeasonFromGameVersion } from '~/utils/lolSeason'
import { apiUrl } from '~/utils/apiUrl'
import { useStatisticsTierListPage } from '~/composables/statistics/useStatisticsTierListPage'
import { useChampionNames } from '~/composables/useChampionNames'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { absoluteSitePath, pageOgImageUrl } from '~/utils/siteUrl'
import { useOgMetaTags } from '~/composables/useOgMetaTags'
import { parseRankTierQuery, rankTierSelectionsEqual } from '~/utils/statisticsRankTierQuery'
import { compareVersionsDesc, normalizeVersionToPrefix } from '~/utils/statistics/statsVersion'
import { riotLanguage } from '~/utils/riotLanguage'
import StatisticsFiltersPanel from '~/components/statistics/StatisticsFiltersPanel.vue'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()
const statisticsUiStore = useStatisticsUiStore()
const { version: gameVersion } = useGameVersion()

// Started here, awaited at the end of setup (after defineExpose): SSR still renders with the names.
const championNamesRequest = useChampionNames()
const { data: championNames } = championNamesRequest

const metaChartSeoTitle = computed(() =>
  t('statisticsPage.metaChartMetaTitle', {
    season: lolSeasonFromGameVersion(gameVersion.value),
    patch: gameVersion.value,
  })
)
const metaChartSeoDescription = computed(() => t('statisticsPage.metaChartMetaDescription'))
const metaChartSiteUrl = useSiteUrl()
const metaChartOgImage = computed(() => pageOgImageUrl(metaChartSiteUrl, 'meta-chart'))
useSeoMeta({
  title: metaChartSeoTitle,
  description: metaChartSeoDescription,
  ogTitle: metaChartSeoTitle,
  ogImage: metaChartOgImage,
  twitterImage: metaChartOgImage,
  twitterCard: 'summary_large_image',
})
useOgMetaTags({
  title: metaChartSeoTitle,
  description: metaChartSeoDescription,
  image: metaChartOgImage,
  url: computed(() => absoluteSitePath(metaChartSiteUrl, '/statistics/meta-chart')),
})

const riotLocale = computed(() => riotLanguage(locale.value))

function queryFirst(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const statsKnownVersions = ref<Array<{ version: string; matchCount: number }>>([])
const metaChartOverviewMatchVersions = ref<Array<{ version: string; matchCount: number }>>([])

function setVersionsWithMatches(
  rows: Array<{ version: string; matchCount: number }> | null | undefined
): void {
  if (!rows?.length) return
  const filtered = rows
    .filter(r => r?.version && Number(r.matchCount) > 0)
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
  statsKnownVersions.value = filtered
  metaChartOverviewMatchVersions.value = filtered
}

async function loadVersionsWithMatches(): Promise<void> {
  const params = new URLSearchParams()
  for (const tier of statsDivisionFilter.value) params.append('rankTier', tier)
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

const statsVersionOptions = computed(() => {
  const fromKnown = statsKnownVersions.value.filter(v => Number(v.matchCount) > 0)
  if (fromKnown.length > 0) return fromKnown
  return [...metaChartOverviewMatchVersions.value]
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
      syncMetaChartStateToQuery()
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

tierList.tierListViewModel.value = 'chart'
tierList.tierListChartType.value = 'bubble'

const { TIER_DIVERGING_LEGEND, toggleTierListChartTier, tierListChartTierEnabled } = tierList

function onStatsFilterChange() {
  tierList.loadTierList().catch(() => undefined)
  if (statsVersionOptions.value.length <= 1) {
    loadVersionsWithMatches().catch(() => undefined)
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

function applyMetaChartStateFromQuery(): void {
  if (isSyncingQueryState.value) return
  const versionRaw = queryFirst(route.query.version as string | string[] | null | undefined)
  const roleRaw = queryFirst(route.query.role as string | string[] | null | undefined).toUpperCase()
  const otpRaw = queryFirst(route.query.otp as string | string[] | null | undefined)
  const divisionsRaw = parseRankTierQuery(
    route.query.rankTier as string | string[] | null | undefined
  )

  isApplyingQueryState.value = true
  statsVersionFilter.value = versionRaw
  statsRoleFilter.value = roleRaw
  if (!rankTierSelectionsEqual(statsDivisionFilter.value, divisionsRaw)) {
    statsDivisionFilter.value = divisionsRaw
  }
  statsOtpFilter.value = otpRaw === 'oui' || otpRaw === 'solo' || otpRaw === 'non' ? otpRaw : 'non'
  isApplyingQueryState.value = false
  if (import.meta.client) {
    syncProgressionDeltaToVersionBeforeFilter()
  }
}

function syncMetaChartStateToQuery(): void {
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

  delete nextQuery.view
  delete nextQuery.sort
  delete nextQuery.botlaneMode

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
    applyMetaChartStateFromQuery()
  }
)

if (import.meta.client) {
  applyMetaChartStateFromQuery()
}

watch([statsVersionFilter, statsRoleFilter, statsOtpFilter, progressionFromVersion], () => {
  syncMetaChartStateToQuery()
})

watch(
  statsDivisionFilter,
  () => {
    if (isApplyingQueryState.value) return
    scheduleDivisionCohortEffects()
  },
  { deep: true }
)

function metaChartBootstrapQueryString(): string {
  const params = new URLSearchParams()
  if (statsVersionFilter.value) params.set('patch', statsVersionFilter.value)
  if (progressionFromVersion.value) params.set('refPatch', progressionFromVersion.value)
  if (statsRoleFilter.value) params.set('role', statsRoleFilter.value)
  if (statsOtpFilter.value !== 'non') params.set('otp', statsOtpFilter.value)
  for (const tier of statsDivisionFilter.value) params.append('rankTier', tier)
  const q = params.toString()
  return q ? `?${q}` : ''
}

async function bootstrapMetaChartPage(): Promise<number> {
  tierList.tierListPending.value = true
  if (import.meta.server) {
    applyMetaChartStateFromQuery()
  }
  const championsPromise = championsStore.loadChampions(riotLocale.value)
  if (!versionStore.currentVersion) {
    await versionStore.loadCurrentVersion()
  }
  try {
    const data = await statsFetch<{
      versions?: Array<{ version: string; matchCount: number }>
      tierList?: NonNullable<typeof tierList.tierListData.value>
      refTierList?: NonNullable<typeof tierList.tierListData.value> | null
    }>(apiUrl(`/api/stats/meta-chart-bootstrap${metaChartBootstrapQueryString()}`))
    if (data?.versions?.length) setVersionsWithMatches(data.versions)
    applyDefaultVersionFiltersFromKnownVersions()
    tierList.applyTierListBootstrap(data.tierList ?? null, data.refTierList ?? null)
  } catch {
    tierList.tierListError.value = 'Meta chart bootstrap failed'
  } finally {
    tierList.tierListPending.value = false
  }
  await championsPromise
  return tierList.tierListData.value?.rows?.length ?? 0
}

const metaChartBootstrapKey = computed(() =>
  [
    riotLocale.value,
    statsVersionFilter.value,
    statsDivisionFilter.value.join(','),
    statsRoleFilter.value,
    statsOtpFilter.value,
    progressionFromVersion.value,
  ].join('|')
)

useAsyncData(() => `meta-chart-bootstrap-${metaChartBootstrapKey.value}`, bootstrapMetaChartPage, {
  watch: [metaChartBootstrapKey],
  lazy: true,
})

onMounted(() => {
  if (import.meta.client) statisticsUiStore.init()
})

// Contexte des onglets (inject 'statisticsPageCtx') : champs explicites ; `reactive` déréférence
// les refs à la lecture et écrit dans `.value` à l'affectation (v-model des onglets).
const statisticsPageCtx = reactive({
  championName: tierList.championName,
  effectiveTierListPatch: tierList.effectiveTierListPatch,
  gameVersion: tierList.gameVersion,
  t,
  tierListChartBarColor: tierList.tierListChartBarColor,
  tierListChartChampionImage: tierList.tierListChartChampionImage,
  tierListChartHeading: tierList.tierListChartHeading,
  tierListChartReferenceRows: tierList.tierListChartReferenceRows,
  tierListChartVisibleRows: tierList.tierListChartVisibleRows,
  tierListError: tierList.tierListError,
  tierListPending: tierList.tierListPending,
  totalTierListCount: tierList.totalTierListCount,
})
provide('statisticsPageCtx', statisticsPageCtx)
defineExpose({ statisticsPageCtx })

await championNamesRequest
</script>
