<template>
  <section
    class="champion-overview-panel rounded-xl border p-4"
    :class="[
      hasAlerts ? 'border-error/50 bg-error/5' : 'border-primary/25 bg-surface/20',
      chartsExpanded ? 'space-y-4' : '',
    ]"
  >
    <div
      v-if="hasAlerts"
      class="rounded-md border border-primary/30 bg-surface/30 px-3 py-2 text-xs"
      role="status"
    >
      <p class="font-semibold text-text/90">{{ t('statisticsPage.surveillanceAlertTitle') }}</p>
      <ul class="mt-1 list-disc space-y-0.5 pl-4">
        <li
          v-for="(line, index) in alertLines"
          :key="index"
          :class="line.tone === 'positive' ? 'text-emerald-400' : 'text-red-400'"
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
        :aria-expanded="chartsExpanded"
        :aria-label="
          chartsExpanded
            ? t('statisticsPage.surveillanceCollapseCharts')
            : t('statisticsPage.surveillanceExpandCharts')
        "
        @click="chartsExpanded = !chartsExpanded"
      >
        <span
          class="inline-block text-sm leading-none transition-transform duration-200"
          :class="chartsExpanded ? 'rotate-0' : '-rotate-90'"
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
    </header>

    <template v-if="chartsExpanded">
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
import type { SurveillanceAlertTrigger } from '~/utils/statisticsSurveillanceAlerts'

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
}>()

const injectedTrendChartUi = inject(SHARED_DAILY_TREND_CHART_UI_KEY, null)
const resolvedTrendChartUi = computed(
  () => props.sharedTrendUi ?? injectedTrendChartUi ?? undefined
)

const { t } = useI18n()
const localePath = useLocalePath()
const { version: gameVersion } = useGameVersion()

const chartsExpanded = ref(true)

const hasAlerts = computed(() => (props.alertTriggers?.length ?? 0) > 0)
const alertLines = computed(() => formatSurveillanceAlertSummary(props.alertTriggers ?? [], t))

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
