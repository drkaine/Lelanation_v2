<template>
  <section
    class="champion-overview-panel rounded-xl border p-4"
    :class="[
      hasAnyAlerts ? 'border-error/50 bg-error/5' : 'border-primary/25 bg-surface/20',
      panelExpanded ? 'space-y-4' : '',
    ]"
  >
    <div
      v-if="hasAnyAlerts"
      class="rounded-md border border-primary/30 bg-surface/30 px-3 py-2 text-xs"
      role="status"
    >
      <p v-if="hasStatsAlerts" class="font-semibold text-text/90">
        {{ t('statisticsPage.surveillanceAlertTitle') }}
      </p>
      <ul v-if="hasStatsAlerts" class="mt-1 list-disc space-y-0.5 pl-4">
        <li
          v-for="(line, index) in alertLines"
          :key="'stats-' + index"
          :class="line.tone === 'positive' ? 'text-info' : 'text-error'"
        >
          {{ line.text }}
        </li>
      </ul>
      <p
        v-if="hasBuildAlerts"
        class="font-semibold text-text/90"
        :class="hasStatsAlerts ? 'mt-2' : ''"
      >
        {{ t('statisticsPage.surveillanceBuildAlertTitle') }}
      </p>
      <ul v-if="hasBuildAlerts" class="mt-1 list-disc space-y-0.5 pl-4">
        <li
          v-for="(line, index) in buildAlertLines"
          :key="'build-' + index"
          :class="line.tone === 'positive' ? 'text-info' : 'text-error'"
        >
          {{ line.text }}
        </li>
      </ul>
    </div>

    <header class="flex flex-wrap items-center gap-2 lg:flex-nowrap">
      <img
        v-if="championImage && gameVersion"
        :src="getChampionImageUrl(gameVersion, championImage)"
        :alt="championName"
        width="28"
        height="28"
        class="h-7 w-7 shrink-0 rounded object-cover"
        loading="lazy"
      />
      <h2 class="min-w-0 shrink-0 truncate text-base font-semibold text-text-accent">
        {{ championName }}
      </h2>
      <div
        v-if="roleDistribution.length > 0"
        class="champion-header-roles flex min-w-0 flex-1 flex-wrap items-center gap-1 text-[11px] text-text/80"
      >
        <span
          v-for="role in roleDistribution"
          :key="role.role"
          class="champion-header-role-badge inline-flex items-center justify-between gap-1 rounded border border-primary/30 bg-surface/40 px-1.5 py-0.5"
          :title="statsRoleLabel(role.role)"
        >
          <img
            :src="statsRoleIconPath(role.role)"
            :alt="statsRoleLabel(role.role)"
            class="h-3 w-3 shrink-0 object-contain"
            width="12"
            height="12"
          />
          <span class="shrink-0 font-medium tabular-nums">
            {{ formatChampionRolePercent(role.pickrate) }}%
          </span>
        </span>
      </div>
      <NuxtLink
        :to="championStatsLink"
        class="shrink-0 text-xs text-accent/90 transition hover:text-accent hover:underline"
      >
        {{ t('statisticsPage.surveillanceViewChampion') }}
      </NuxtLink>
      <button
        type="button"
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center text-text/70 transition hover:text-text"
        :aria-expanded="panelExpanded"
        :aria-label="
          panelExpanded
            ? t('statisticsPage.surveillanceCollapseCharts')
            : t('statisticsPage.surveillanceExpandCharts')
        "
        @click="panelExpanded = !panelExpanded"
      >
        <span
          class="inline-block text-sm leading-none transition-transform duration-200"
          :class="panelExpanded ? 'rotate-0' : '-rotate-90'"
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
    </header>

    <div v-if="panelExpanded" class="flex flex-wrap gap-1 border-b border-primary/20 pb-2">
      <button
        type="button"
        class="rounded-t border px-3 py-1.5 text-xs font-medium transition"
        :class="
          activeTab === 'charts'
            ? 'border-primary/40 border-b-transparent bg-surface/40 text-text'
            : 'border-transparent text-text/60 hover:text-text'
        "
        @click="activeTab = 'charts'"
      >
        {{ t('statisticsPage.surveillanceTabCharts') }}
      </button>
      <button
        type="button"
        class="rounded-t border px-3 py-1.5 text-xs font-medium transition"
        :class="
          activeTab === 'builds'
            ? 'border-primary/40 border-b-transparent bg-surface/40 text-text'
            : 'border-transparent text-text/60 hover:text-text'
        "
        @click="activeTab = 'builds'"
      >
        {{ t('statisticsPage.surveillanceTabBuilds') }}
        <span
          v-if="hasBuildAlerts"
          class="ml-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-accent/20 px-1 text-[10px] text-accent"
        >
          {{ buildAlertTriggers?.length ?? 0 }}
        </span>
      </button>
    </div>

    <template v-if="panelExpanded && activeTab === 'charts'">
      <StatisticsDailyTrendChartsPanel
        :points="trendPoints"
        :pending="trendPending"
        :error="trendError"
        :filter-rank="filterRank"
        :versions-catalog="versionsCatalog"
        :show-banrate="true"
        :show-toolbar="false"
        :shared-trend-ui="resolvedTrendChartUi"
        :title="t('statisticsPage.championStatsTrendsTitle')"
      />

      <ChampionDurationByTierCharts
        :duration-data="durationData"
        :trend-points="trendPoints"
        :filter-rank="filterRank"
        :pending="durationPending"
      />
    </template>

    <ChampionBuildsSurveillancePanel
      v-if="panelExpanded && activeTab === 'builds'"
      :champion-key="championKey"
      :filter-role="filterRole"
      :filter-rank="filterRank"
      :filter-version="filterVersion"
      :alert-filter-ids="alertFilterIds"
      :build-alert-triggers="buildAlertTriggers ?? []"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import {
  championRoleDistributionSorted,
  formatChampionRolePercent,
} from '~/utils/championRoleDistribution'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { statsRoleIconPath, statsRoleLabel } from '~/utils/statsRoleDisplay'
import { useGameVersion } from '~/composables/useGameVersion'
import {
  SHARED_DAILY_TREND_CHART_UI_KEY,
  resolveTrendSnapshotsQueryFrom,
  type DailyTrendSnapshotPoint,
  type SharedDailyTrendChartUi,
} from '~/composables/statistics/useStatisticsDailyTrendCharts'
import type { ChampionDurationByTierData } from '~/composables/statistics/useChampionDurationByTierCharts'
import { formatSurveillanceAlertSummary } from '~/utils/formatSurveillanceAlert'
import { formatBuildSurveillanceAlertSummary } from '~/utils/formatBuildSurveillanceAlert'
import type { SurveillanceAlertTrigger } from '~/utils/statisticsSurveillanceAlerts'
import type { BuildSurveillanceTrigger } from '~/utils/buildSurveillance'
import type { SurveillanceAlertFilterId } from '~/utils/surveillanceAlertFilters'
import ChampionBuildsSurveillancePanel from '~/components/statistics/ChampionBuildsSurveillancePanel.vue'

const props = defineProps<{
  championKey: number
  championSlug: string
  championName: string
  championImage?: string
  filterRole: string
  filterRank: string[]
  filterVersion: string
  versionsCatalog: Array<{ patchLabel: string; releaseDate: string }>
  sharedTrendUi?: SharedDailyTrendChartUi
  alertTriggers?: SurveillanceAlertTrigger[]
  buildAlertTriggers?: BuildSurveillanceTrigger[]
  alertFilterIds?: SurveillanceAlertFilterId[]
}>()

const injectedTrendChartUi = inject(SHARED_DAILY_TREND_CHART_UI_KEY, null)
const resolvedTrendChartUi = computed(
  () => props.sharedTrendUi ?? injectedTrendChartUi ?? undefined
)

const { t } = useI18n()
const localePath = useLocalePath()
const { version: gameVersion } = useGameVersion()

const panelExpanded = ref(true)
const activeTab = ref<'charts' | 'builds'>('charts')

const hasStatsAlerts = computed(() => (props.alertTriggers?.length ?? 0) > 0)
const hasBuildAlerts = computed(() => (props.buildAlertTriggers?.length ?? 0) > 0)
const hasAnyAlerts = computed(() => hasStatsAlerts.value || hasBuildAlerts.value)
const alertLines = computed(() => formatSurveillanceAlertSummary(props.alertTriggers ?? [], t))
const buildAlertLines = computed(() =>
  formatBuildSurveillanceAlertSummary(props.buildAlertTriggers ?? [], t)
)

const championStatsLink = computed(() =>
  localePath({
    path: `/statistics/champion/${props.championSlug}`,
    query: buildSharedQuery(),
  })
)

function buildSharedQuery(): Record<string, string | string[]> {
  const q: Record<string, string | string[]> = {}
  if (props.filterVersion) q.version = props.filterVersion
  if (props.filterRole) q.role = props.filterRole
  if (props.filterRank.length > 0) q.rankTier = [...props.filterRank]
  return q
}

const trendPoints = ref<DailyTrendSnapshotPoint[]>([])
const trendPending = ref(false)
const trendError = ref<string | null>(null)
const durationData = ref<ChampionDurationByTierData | null>(null)
const durationPending = ref(false)

type ChampionSummaryResponse = {
  byRole?: Record<string, { games?: number; wins?: number; winrate?: number }>
}

const championSummary = ref<ChampionSummaryResponse | null>(null)

const roleDistribution = computed(() =>
  championRoleDistributionSorted(championSummary.value?.byRole, { minGames: 1 })
)

function buildRoleStatsQuery(): string {
  const p = new URLSearchParams()
  if (props.filterVersion) p.set('version', props.filterVersion)
  for (const tier of props.filterRank) {
    const normalized = String(tier || '')
      .trim()
      .toUpperCase()
      .split('_')[0]
    if (normalized) p.append('rankTier', normalized)
  }
  p.set('otp', 'oui')
  return p.toString() ? `?${p.toString()}` : ''
}

async function loadChampionRoleStats(): Promise<void> {
  if (!props.championKey) return
  try {
    const data = await $fetch<ChampionSummaryResponse>(
      apiUrl(`/api/stats/champions/${props.championKey}${buildRoleStatsQuery()}`)
    )
    championSummary.value = data
  } catch {
    championSummary.value = null
  }
}

async function loadTrendSnapshots(): Promise<void> {
  if (!props.championKey) return
  trendPending.value = true
  trendError.value = null
  try {
    const params = new URLSearchParams()
    if (props.filterRole) params.set('role', props.filterRole)
    for (const tier of props.filterRank) {
      const normalized = String(tier || '')
        .trim()
        .toUpperCase()
        .split('_')[0]
      if (normalized) params.append('rankTier', normalized)
    }
    const rangeUi = resolvedTrendChartUi.value
    params.set(
      'from',
      resolveTrendSnapshotsQueryFrom({
        rangeMode: rangeUi?.trendRangeMode.value ?? '7d',
        monthsWindow: rangeUi?.trendMonthsWindow.value ?? 1,
      })
    )
    params.set('limit', '1200')
    const query = params.toString()
    const data = await $fetch<{ points?: DailyTrendSnapshotPoint[] }>(
      apiUrl(
        `/api/stats/champions/${props.championKey}/tier-trend-snapshots${query ? `?${query}` : ''}`
      )
    )
    trendPoints.value = Array.isArray(data?.points) ? data.points : []
  } catch (e) {
    trendPoints.value = []
    trendError.value = e instanceof Error ? e.message : String(e)
  } finally {
    trendPending.value = false
  }
}

async function loadDurationByTier(): Promise<void> {
  if (!props.championKey) return
  durationPending.value = true
  try {
    const p = new URLSearchParams()
    if (props.filterVersion) p.set('version', props.filterVersion)
    if (props.filterRole) p.set('role', props.filterRole)
    const q = p.toString()
    durationData.value = await $fetch<ChampionDurationByTierData>(
      apiUrl(
        `/api/stats/champions/${props.championKey}/duration-winrate-by-tier${q ? `?${q}` : ''}`
      )
    )
  } catch {
    durationData.value = null
  } finally {
    durationPending.value = false
  }
}

async function reloadOverviewData(): Promise<void> {
  await Promise.all([loadTrendSnapshots(), loadDurationByTier(), loadChampionRoleStats()])
}

watch(
  () =>
    [
      props.championKey,
      props.filterRole,
      props.filterRank.join('\0'),
      props.filterVersion,
    ] as const,
  () => {
    reloadOverviewData().catch(() => undefined)
  },
  { immediate: true }
)

function trendChartUiRefs(): SharedDailyTrendChartUi | null {
  return props.sharedTrendUi ?? injectedTrendChartUi ?? null
}

watch(
  () => trendChartUiRefs()?.trendRangeMode.value,
  () => {
    if (!props.championKey) return
    loadTrendSnapshots().catch(() => undefined)
  }
)

watch(
  () => trendChartUiRefs()?.trendMonthsWindow.value,
  () => {
    if (!props.championKey) return
    loadTrendSnapshots().catch(() => undefined)
  }
)
</script>
