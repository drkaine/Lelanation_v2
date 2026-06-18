<template>
  <div
    class="statistics-surveillance flex min-h-screen min-w-0 flex-col overflow-x-hidden bg-background text-text"
  >
    <div class="w-full flex-shrink-0 px-3 py-4 sm:px-5 lg:px-6">
      <div
        v-if="!pageReady"
        class="rounded-lg border border-primary/25 bg-surface/30 p-6 text-sm text-text/70"
      >
        {{ t('statisticsPage.loading') }}
      </div>

      <template v-else>
        <div
          v-if="watchedChampionIds.length === 0"
          class="rounded-lg border border-primary/25 bg-surface/30 p-6 text-sm text-text/75"
        >
          <p>{{ t('statisticsPage.surveillanceEmpty') }}</p>
          <NuxtLink
            :to="localePath('/statistics/settings')"
            class="mt-3 inline-flex rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10"
          >
            {{ t('statisticsPage.surveillanceSettingsLink') }}
          </NuxtLink>
        </div>

        <div
          v-else-if="watchedChampions.length === 0"
          class="rounded-lg border border-primary/25 bg-surface/30 p-6 text-sm text-text/75"
        >
          <p>{{ t('statisticsPage.surveillanceResolveError') }}</p>
        </div>

        <StatisticsFiltersPanel
          v-else
          :active-filters-count="activeSurveillanceFiltersCount"
          @reset="resetSurveillanceFilters"
        >
          <div class="statistics-filters-fields flex flex-col gap-3">
            <div>
              <label :for="searchInputId" class="mb-1 block text-sm font-medium text-text">
                {{ t('statisticsPage.surveillanceSearchLabel') }}
              </label>
              <input
                :id="searchInputId"
                v-model="championSearchQuery"
                type="search"
                :placeholder="t('statisticsPage.surveillanceSearchPlaceholder')"
                class="w-full rounded border border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-medium text-text placeholder:text-text/45 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <StatisticsCohortFiltersFields
              v-model:filter-rank="filterRank"
              v-model:filter-role="filterRole"
            />

            <StatisticsDailyTrendToolbar stacked />
          </div>

          <template #main>
            <div class="w-full space-y-6">
              <p v-if="filteredWatchedChampions.length === 0" class="text-sm text-text/60">
                {{ t('statisticsPage.surveillanceSearchNoResults') }}
              </p>

              <div v-else class="space-y-8">
                <ClientOnly>
                  <ChampionOverviewPanel
                    v-for="champion in sortedWatchedChampions"
                    :key="champion.slug"
                    :champion-key="champion.key"
                    :champion-slug="champion.slug"
                    :champion-name="champion.name"
                    :champion-image="champion.image"
                    :filter-role="filterRole"
                    :filter-rank="filterRank"
                    :filter-version="filterVersion"
                    :versions-catalog="versionsCatalog"
                    :shared-trend-ui="sharedTrendSettings"
                    :alert-triggers="alertTriggersFor(champion.key)"
                  />
                </ClientOnly>
              </div>
            </div>
          </template>
        </StatisticsFiltersPanel>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import ChampionOverviewPanel from '~/components/statistics/ChampionOverviewPanel.vue'
import StatisticsCohortFiltersFields from '~/components/statistics/StatisticsCohortFiltersFields.vue'
import StatisticsDailyTrendToolbar from '~/components/statistics/StatisticsDailyTrendToolbar.vue'
import StatisticsFiltersPanel from '~/components/statistics/StatisticsFiltersPanel.vue'
import { SHARED_DAILY_TREND_CHART_UI_KEY } from '~/composables/statistics/useStatisticsDailyTrendCharts'
import { createSharedDailyTrendChartSettings } from '~/composables/statistics/useSharedDailyTrendChartSettings'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useStatisticsSurveillanceAlertStore } from '~/stores/StatisticsSurveillanceAlertStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useSurveillanceAlertEvaluation } from '~/composables/useSurveillanceAlertEvaluation'
import { championKeyFromRouteParam, normalizeChampionSlug } from '~/utils/championSlug'
import { parseRankTierQuery, rankTierSelectionsEqual } from '~/utils/statisticsRankTierQuery'

definePageMeta({
  ssr: false,
})

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const championsStore = useChampionsStore()
const statisticsUiStore = useStatisticsUiStore()
const alertStore = useStatisticsSurveillanceAlertStore()
const versionStore = useVersionStore()
const { runSurveillanceAlertCheck } = useSurveillanceAlertEvaluation()

const { watchedChampionIds } = storeToRefs(statisticsUiStore)

const pageReady = ref(false)
const versionsCatalog = ref<Array<{ patchLabel: string; releaseDate: string }>>([])
const championSearchQuery = ref('')
const searchInputId = 'surveillance-champion-search'

const filterVersion = ref('')
const filterRole = ref('')
const filterRank = ref<string[]>([])

const isApplyingQueryState = ref(false)
const isSyncingQueryState = ref(false)

const sharedTrendSettings = createSharedDailyTrendChartSettings(filterRank)
provide(SHARED_DAILY_TREND_CHART_UI_KEY, sharedTrendSettings)

const activeSurveillanceFiltersCount = computed(() => {
  let count = 0
  if (filterRank.value.length > 0) count++
  if (filterRole.value) count++
  if (filterVersion.value) count++
  if (championSearchQuery.value.trim()) count++
  if (sharedTrendSettings.trendGranularity.value !== 'day') count++
  if (sharedTrendSettings.trendRangeMode.value !== '7d') count++
  if (sharedTrendSettings.trendDivisionPreset.value !== 'selected') count++
  if (!sharedTrendSettings.trendShowGlobalLine.value) count++
  return count
})

function resetSurveillanceTrendSettings(): void {
  sharedTrendSettings.trendGranularity.value = 'day'
  sharedTrendSettings.trendRangeMode.value = '7d'
  sharedTrendSettings.trendMonthsWindow.value = 1
  sharedTrendSettings.trendDivisionPreset.value = 'selected'
  sharedTrendSettings.trendShowGlobalLine.value = true
}

function queryFirst(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '')
  return value ? String(value) : ''
}

function applyFiltersFromQuery(): void {
  const versionRaw = queryFirst(route.query.version as string | string[] | null | undefined)
  const roleRaw = queryFirst(route.query.role as string | string[] | null | undefined).toUpperCase()
  const divisionsRaw = parseRankTierQuery(
    route.query.rankTier as string | string[] | null | undefined
  )

  isApplyingQueryState.value = true
  filterVersion.value = versionRaw
  filterRole.value = roleRaw
  if (!rankTierSelectionsEqual(filterRank.value, divisionsRaw)) {
    filterRank.value = divisionsRaw
  }
  isApplyingQueryState.value = false
}

function resetSurveillanceFilters(): void {
  filterRank.value = []
  filterRole.value = ''
  filterVersion.value = ''
  championSearchQuery.value = ''
  resetSurveillanceTrendSettings()
}

watch(
  () => route.query,
  () => applyFiltersFromQuery(),
  { immediate: true, deep: true }
)

watch([filterVersion, filterRole, filterRank], () => {
  if (!import.meta.client || isApplyingQueryState.value) return
  if (isSyncingQueryState.value) return

  const nextQuery = { ...route.query } as Record<string, string | string[] | undefined>
  if (filterVersion.value) nextQuery.version = filterVersion.value
  else delete nextQuery.version
  if (filterRole.value) nextQuery.role = filterRole.value
  else delete nextQuery.role
  if (filterRank.value.length > 0) nextQuery.rankTier = [...filterRank.value]
  else delete nextQuery.rankTier

  const currentVersion = queryFirst(route.query.version as string | string[] | null | undefined)
  const currentRole = queryFirst(
    route.query.role as string | string[] | null | undefined
  ).toUpperCase()
  const currentDivisions = parseRankTierQuery(
    route.query.rankTier as string | string[] | null | undefined
  )
  if (
    currentVersion === filterVersion.value &&
    currentRole === filterRole.value &&
    rankTierSelectionsEqual(currentDivisions, filterRank.value)
  ) {
    return
  }

  isSyncingQueryState.value = true
  router.replace({ query: nextQuery }).finally(() => {
    isSyncingQueryState.value = false
  })
})

function resolveWatchedChampion(id: string) {
  const raw = String(id ?? '').trim()
  if (!raw) return null

  if (/^\d+$/.test(raw)) {
    const key = parseInt(raw, 10)
    if (!Number.isFinite(key) || key <= 0) return null
    const champ = championsStore.champions.find(c => String(c.key) === String(key))
    return {
      slug: normalizeChampionSlug(champ?.id ?? raw),
      key,
      name: champ?.name ?? raw,
      image: champ?.image?.full,
    }
  }

  const key = championKeyFromRouteParam(raw, championsStore.champions)
  if (!key) return null
  const champ =
    championsStore.champions.find(c => String(c.key) === String(key)) ??
    championsStore.champions.find(c => normalizeChampionSlug(c.id) === normalizeChampionSlug(raw))
  return {
    slug: normalizeChampionSlug(champ?.id ?? raw),
    key,
    name: champ?.name ?? raw,
    image: champ?.image?.full,
  }
}

const watchedChampions = computed(() =>
  watchedChampionIds.value
    .map(id => resolveWatchedChampion(id))
    .filter((c): c is NonNullable<typeof c> => c !== null)
)

const filteredWatchedChampions = computed(() => {
  const query = championSearchQuery.value.trim().toLowerCase()
  if (!query) return watchedChampions.value
  return watchedChampions.value.filter(champion => {
    const name = champion.name.toLowerCase()
    const slug = champion.slug.toLowerCase()
    return name.includes(query) || slug.includes(query)
  })
})

const sortedWatchedChampions = computed(() => {
  const champions = filteredWatchedChampions.value
  return [...champions].sort((a, b) => {
    const aAlert = alertStore.hasAlert(String(a.key))
    const bAlert = alertStore.hasAlert(String(b.key))
    if (aAlert && !bAlert) return -1
    if (!aAlert && bAlert) return 1
    return 0
  })
})

function alertTriggersFor(championKey: number) {
  return alertStore.triggersFor(String(championKey))
}

async function loadVersionsCatalog(): Promise<void> {
  try {
    const versionsData = await $fetch<{
      versions?: Array<{ version?: string; patchLabel?: string; releaseDate?: string }>
    }>('/data/game/versions.json')
    const rows =
      versionsData?.versions
        ?.map(v => ({
          patchLabel: String(v.patchLabel ?? v.version ?? '').trim(),
          releaseDate: String(v.releaseDate ?? '').trim(),
        }))
        .filter(v => v.patchLabel && /^\d{4}-\d{2}-\d{2}$/.test(v.releaseDate)) ?? []
    versionsCatalog.value = rows.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
  } catch {
    versionsCatalog.value = []
  }
}

async function bootstrapPage(): Promise<void> {
  statisticsUiStore.init()
  alertStore.init()
  await versionStore.loadCurrentVersion().catch(() => undefined)
  const lang = locale.value === 'fr' ? 'fr_FR' : 'en_US'
  await championsStore.loadChampions(lang).catch(() => undefined)
  await loadVersionsCatalog()
  await runSurveillanceAlertCheck().catch(() => undefined)
  alertStore.acknowledgeAlerts()
}

onMounted(async () => {
  pageReady.value = false
  try {
    await bootstrapPage()
  } finally {
    pageReady.value = true
  }
})

watch(
  () => locale.value,
  () => {
    bootstrapPage().catch(() => undefined)
  }
)

useHead({
  title: () => t('statisticsPage.surveillanceTitle'),
})
</script>

<style>
@media (max-width: 1023px) {
  .statistics-surveillance .statistics-filters-panel .flex.min-h-0.flex-1 {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
