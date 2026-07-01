<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'
import { statsRoleIconPath, statsRoleLabel } from '~/utils/statsRoleDisplay'

export type ItemDivisionWinRow = {
  rankTier: string
  games: number
  wins: number
  winrate: number | null
}

export type ItemRoleWinBreakdown = {
  role: string
  byDivision: ItemDivisionWinRow[]
  totalGames: number
}

export type ItemPurchaseTimingRow = {
  rankTier: string
  games: number
  avgPurchaseMs: number | null
}

export type ItemTierBreakdown = {
  roles: ItemRoleWinBreakdown[]
  roleTrendPoints?: DailyTrendSnapshotPoint[]
  purchaseTiming: ItemPurchaseTimingRow[]
  overallAvgPurchaseMs: number | null
}

const props = withDefaults(
  defineProps<{
    breakdown: ItemTierBreakdown | null
    pending?: boolean
    error?: string | null
    activeRoleFilter?: string
    filterRank?: string[]
    versionsCatalog?: Array<{ patchLabel: string; releaseDate: string }>
  }>(),
  {
    pending: false,
    error: null,
    activeRoleFilter: '',
    filterRank: () => [],
    versionsCatalog: () => [],
  }
)

const { t } = useI18n()

const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

const visibleRoles = computed(() => {
  const roles = props.breakdown?.roles ?? []
  const filter = props.activeRoleFilter?.trim().toUpperCase()
  const withGames = roles.filter(r => r.totalGames > 0)
  if (!filter) return withGames
  return withGames.filter(r => r.role === filter)
})

function pointsForRole(role: string): DailyTrendSnapshotPoint[] {
  return (props.breakdown?.roleTrendPoints ?? []).filter(p => p.role === role && p.games > 0)
}

const rolePanels = computed(() =>
  visibleRoles.value
    .map(roleBlock => ({
      role: roleBlock.role,
      totalGames: roleBlock.totalGames,
      points: pointsForRole(roleBlock.role),
    }))
    .filter(panel => panel.points.length > 0)
    .sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number]) -
        ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number])
    )
)

const hasAnyData = computed(() => rolePanels.value.length > 0)

function rolePanelTitle(role: string): string {
  return `${statsRoleLabel(role)} — ${t('statisticsPage.winrate')}`
}
</script>

<template>
  <div class="item-breakdown-charts space-y-3">
    <h2 class="text-base font-semibold text-text">
      {{ t('statisticsPage.itemStatsWinrateByDivisionTitle') }}
    </h2>

    <div v-if="pending" class="py-4 text-text/70">{{ t('statisticsPage.loading') }}</div>
    <p v-else-if="error" class="py-2 text-sm text-error">{{ error }}</p>
    <p v-else-if="!hasAnyData" class="statistics-empty-panel p-4">
      {{ t('statisticsPage.itemStatsBreakdownEmpty') }}
    </p>
    <div v-else class="flex w-full min-w-0 flex-col gap-6">
      <div v-for="panel in rolePanels" :key="panel.role" class="w-full min-w-0">
        <div class="mb-2 flex flex-wrap items-center gap-2 text-sm text-text">
          <img
            v-if="statsRoleIconPath(panel.role)"
            :src="statsRoleIconPath(panel.role)"
            :alt="statsRoleLabel(panel.role)"
            class="h-4 w-4 object-contain"
            width="16"
            height="16"
          />
          <span class="font-medium text-text">{{ statsRoleLabel(panel.role) }}</span>
          <span class="text-xs text-text/55">
            ({{ panel.totalGames.toLocaleString() }} {{ t('statisticsPage.games') }})
          </span>
        </div>
        <StatisticsDailyTrendChartsPanel
          :points="panel.points"
          :filter-rank="filterRank"
          :versions-catalog="versionsCatalog"
          :title="rolePanelTitle(panel.role)"
          :enabled-metrics="['winrate']"
          :show-division-presets="false"
        />
      </div>
    </div>
  </div>
</template>
