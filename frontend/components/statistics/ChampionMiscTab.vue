<template>
  <div class="champion-misc-tab">
    <div v-if="pending" class="text-sm text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>
    <div
      v-else-if="!hasData"
      class="rounded-lg border border-primary/30 bg-surface/50 p-4 text-sm text-text/70"
    >
      {{ t('statisticsPage.championMiscEmpty') }}
    </div>
    <template v-else>
      <div
        class="champion-misc-grid flex w-full min-w-0 max-w-full flex-wrap items-stretch justify-center gap-x-[5px] gap-y-[10px] pb-[10px] max-lg:px-0"
      >
        <div
          v-for="group in visibleGroups"
          :key="group.key"
          class="fast-stat-card fast-stat-card-misc team-side-fast-stat rounded-lg border p-2"
          :class="groupCardClass(group.key)"
        >
          <h3
            class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold leading-snug"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-base"
              :class="groupIconWrapClass(group.key)"
              aria-hidden="true"
            >
              {{ groupIcon(group.key) }}
            </span>
            <span class="min-w-0 flex-1 leading-tight">
              {{ t(`statisticsPage.championMiscGroup_${group.key}`) }}
            </span>
          </h3>
          <table class="fast-stat-table w-full text-xs">
            <tbody>
              <tr v-for="metric in group.metrics" :key="metric.key" class="fast-stat-row">
                <td class="py-1 align-middle">
                  <div class="flex min-w-0 items-center gap-1.5">
                    <span
                      v-if="metricSwatch(group.key, metric.key)"
                      class="h-2.5 w-2.5 shrink-0 rounded-sm"
                      :style="{ backgroundColor: metricSwatch(group.key, metric.key) }"
                      aria-hidden="true"
                    />
                    <span class="min-w-0 flex-1 truncate font-medium text-text/90">
                      {{ t(`statisticsPage.championMisc_${group.key}_${metric.key}`) }}
                    </span>
                    <span
                      class="ml-1 shrink-0 text-right font-semibold tabular-nums"
                      :class="metricValueClass(group.key)"
                    >
                      {{ formatMetric(metric) }}
                    </span>
                  </div>
                  <div v-if="showBar(group.key, metric)" class="mt-1.5 flex items-center gap-2">
                    <div class="champion-misc-bar-track h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        class="h-full rounded-full transition-[width] duration-300"
                        :class="metricBarClass(group.key, metric.key)"
                        :style="{ width: `${metricBarPct(metric, group.metrics)}%` }"
                      />
                    </div>
                    <span
                      class="champion-misc-bar-pct shrink-0 text-[10px] tabular-nums text-text/55"
                    >
                      {{ metricBarPctLabel(metric, group.metrics) }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type ChampionMiscMetric = { key: string; avgPerGame: number }
export type ChampionMiscMetricGroup = { key: string; metrics: ChampionMiscMetric[] }
export type ChampionMiscSummary = {
  games?: number
  groups?: ChampionMiscMetricGroup[]
}

const props = defineProps<{
  data: ChampionMiscSummary | null
  pending?: boolean
}>()

const { t } = useI18n()

const gamesCount = computed(() => Number(props.data?.games ?? 0))

const displayGroups = computed(() => props.data?.groups ?? [])

const visibleGroups = computed(() =>
  displayGroups.value
    .map(g => ({
      ...g,
      metrics: g.metrics.filter(m => Number(m.avgPerGame) > 0),
    }))
    .filter(g => g.metrics.length > 0)
)

const hasData = computed(() => gamesCount.value > 0 && visibleGroups.value.length > 0)

const GROUP_CARD_CLASS: Record<string, string> = {
  healing: 'border-emerald-500/45 bg-emerald-500/[0.06]',
  damageTypes: 'border-primary/30 bg-surface/30',
  multikills: 'border-violet-500/45 bg-violet-500/[0.06]',
}

const GROUP_ICON_WRAP: Record<string, string> = {
  healing: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
  damageTypes: 'border-amber-500/35 bg-amber-500/10 text-amber-300',
  multikills: 'border-violet-500/35 bg-violet-500/10 text-violet-300',
}

const GROUP_ICON: Record<string, string> = {
  healing: '♥',
  damageTypes: '⚔',
  multikills: '✦',
}

const DAMAGE_SWATCH: Record<string, string> = {
  physicalDone: '#f59e0b',
  magicDone: '#8b5cf6',
  trueDone: '#94a3b8',
}

const MULTIKILL_KEYS = new Set(['double', 'triple', 'quadra', 'penta', 'unreal'])

function groupCardClass(key: string): string {
  return GROUP_CARD_CLASS[key] ?? 'border-primary/30 bg-surface/30'
}

function groupIconWrapClass(key: string): string {
  return GROUP_ICON_WRAP[key] ?? 'border-primary/30 bg-black/10 text-text/70'
}

function groupIcon(key: string): string {
  return GROUP_ICON[key] ?? '◆'
}

function metricSwatch(groupKey: string, metricKey: string): string | undefined {
  if (groupKey === 'damageTypes') return DAMAGE_SWATCH[metricKey]
  return undefined
}

function metricValueClass(groupKey: string): string {
  if (groupKey === 'healing') return 'text-emerald-300'
  if (groupKey === 'multikills') return 'text-violet-200'
  return 'text-accent'
}

function metricBarClass(groupKey: string, metricKey: string): string {
  if (groupKey === 'damageTypes') {
    if (metricKey === 'physicalDone') return 'bg-amber-400'
    if (metricKey === 'magicDone') return 'bg-violet-500'
    if (metricKey === 'trueDone') return 'bg-slate-400'
  }
  if (groupKey === 'healing') return 'bg-emerald-500/80'
  if (groupKey === 'multikills') return 'bg-violet-500/80'
  return 'bg-accent/80'
}

function showBar(groupKey: string, metric: ChampionMiscMetric): boolean {
  return Number(metric.avgPerGame) > 0
}

function metricBarPct(metric: ChampionMiscMetric, metrics: ChampionMiscMetric[]): number {
  const v = Number(metric.avgPerGame)
  if (!Number.isFinite(v) || v <= 0) return 0
  const max = Math.max(...metrics.map(m => Number(m.avgPerGame) || 0), 1)
  return Math.min(100, (v / max) * 100)
}

function metricBarPctLabel(metric: ChampionMiscMetric, metrics: ChampionMiscMetric[]): string {
  return `${Math.round(metricBarPct(metric, metrics))}%`
}

function formatMetric(metric: ChampionMiscMetric): string {
  const v = Number(metric.avgPerGame)
  if (!Number.isFinite(v)) return '—'
  if (MULTIKILL_KEYS.has(metric.key)) {
    return v < 0.01 ? '< 0.01' : v.toFixed(2)
  }
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
</script>

<style scoped>
.champion-misc-tab .fast-stat-title {
  line-height: 1.4;
  color: rgb(252 211 77) !important;
}

.champion-misc-tab .fast-stat-table {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
}

.champion-misc-tab .fast-stat-row {
  border-bottom: 1px solid rgb(var(--rgb-primary) / 0.1);
}

.champion-misc-tab .fast-stat-row:last-child {
  border-bottom: none;
}

.champion-misc-bar-track {
  background: rgb(15 23 42 / 0.75);
  border: 1px solid rgb(var(--rgb-primary) / 0.18);
}

.champion-misc-tab {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.champion-misc-tab .fast-stat-card-misc {
  margin-bottom: 0;
  width: 313px;
  min-width: 313px;
  max-width: 313px;
  min-height: 200px;
  height: auto;
  flex: 0 0 313px;
  margin-left: auto;
  margin-right: auto;
  background: #08101f !important;
  justify-self: center;
  overflow: hidden;
  box-sizing: border-box;
}

@media (max-width: 1023px) {
  .champion-misc-tab .champion-misc-grid > .fast-stat-card-misc {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    flex: 1 1 100% !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
    align-self: stretch;
    padding: 0.85rem 1rem !important;
  }

  .champion-misc-tab .fast-stat-title {
    font-size: 1rem !important;
    line-height: 1.35;
  }

  .champion-misc-tab .fast-stat-table {
    font-size: 0.875rem;
  }
}
</style>
