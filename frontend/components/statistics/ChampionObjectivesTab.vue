<template>
  <div class="champion-objectives-tab space-y-4">
    <div v-if="pending" class="text-text/70">
      {{ t('statisticsPage.loading') }}
    </div>

    <div
      v-else-if="!hasData"
      class="rounded border border-primary/30 bg-surface/50 p-4 text-sm text-text/70"
    >
      {{ t('statisticsPage.objectivesCombinedEmpty') }}
    </div>

    <template v-else>
      <div
        class="fast-stat-card fast-stat-card-objectives w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <div class="mb-3 flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded px-2 py-1 text-xs font-semibold transition-colors"
            :class="
              panelTab === 'objectives'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="panelTab = 'objectives'"
          >
            {{ t('statisticsPage.objectivesTabMain') }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs font-semibold transition-colors"
            :class="
              panelTab === 'drakeTypes'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="panelTab = 'drakeTypes'"
          >
            {{ t('statisticsPage.objectivesTabDrakeTypes') }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs font-semibold transition-colors"
            :class="
              panelTab === 'drakeSouls'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="panelTab = 'drakeSouls'"
          >
            {{ t('statisticsPage.objectivesTabSouls') }}
          </button>
          <div
            v-if="panelTab === 'objectives'"
            class="ml-auto inline-flex overflow-hidden rounded border border-primary/30 text-xs"
          >
            <button
              type="button"
              class="px-2 py-1 font-semibold transition-colors"
              :class="
                displayMode === 'obtention'
                  ? 'bg-accent text-background'
                  : 'bg-black/20 text-text/80 hover:bg-white/10'
              "
              @click="displayMode = 'obtention'"
            >
              {{ t('statisticsPage.objectivesModeObtention') }}
            </button>
            <button
              type="button"
              class="border-l border-primary/30 px-2 py-1 font-semibold transition-colors"
              :class="
                displayMode === 'winrate'
                  ? 'bg-accent text-background'
                  : 'bg-black/20 text-text/80 hover:bg-white/10'
              "
              @click="displayMode = 'winrate'"
            >
              {{ t('statisticsPage.objectivesModeWinrate') }}
            </button>
          </div>
          <span
            class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
            :aria-label="t('statisticsPage.championObjectivesTooltip')"
          >
            ⓘ
            <span
              role="tooltip"
              class="fast-stat-tooltip-popover fast-stat-tooltip-popover--objectives fast-stat-tooltip-popover--end hidden group-hover/stat-tip:block"
            >
              {{ t('statisticsPage.championObjectivesTooltip') }}
            </span>
          </span>
        </div>

        <p class="mb-3 text-xs text-text/55">
          {{
            t('statisticsPage.championObjectivesSample', {
              count: games,
              winrate: winrate.toFixed(1),
            })
          }}
        </p>

        <!-- Onglet principal -->
        <div
          v-if="panelTab === 'objectives' && displayMode === 'obtention'"
          class="w-full min-w-0 space-y-4"
        >
          <div
            class="grid grid-cols-2 gap-2 rounded border border-primary/20 bg-black/15 p-2 sm:grid-cols-4"
          >
            <div
              v-for="metric in participationMetrics"
              :key="metric.key"
              class="px-1 py-1 text-center"
            >
              <div class="text-[10px] leading-snug text-text/55">{{ metric.label }}</div>
              <div class="text-sm font-semibold tabular-nums text-accent">
                {{ formatPct(metric.value) }}
              </div>
            </div>
          </div>

          <div class="hidden min-w-0 overflow-x-auto md:block">
            <table class="objectives-zebra-cols w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.championObjectivesColName') }}
                  </th>
                  <th class="px-1 py-1.5 text-center font-medium">
                    {{ t('statisticsPage.objectiveKillRate') }}
                  </th>
                  <th class="px-1 py-1.5 text-center font-medium">
                    {{ t('statisticsPage.objectiveAssistRate') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">
                    {{ t('statisticsPage.objectiveSoloRate') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr v-for="row in objectiveRows" :key="row.key">
                  <td class="py-1.5 pr-2">
                    <div class="flex items-center gap-1 font-medium text-text/90">
                      <img
                        v-if="objectiveIconSrc(row.key)"
                        :src="objectiveIconSrc(row.key)"
                        :alt="objectiveLabel(row.key, row.label)"
                        class="h-4 w-4 object-contain"
                        loading="lazy"
                        decoding="async"
                        @error="onObjectiveIconError($event, row.key)"
                      />
                      {{ objectiveLabel(row.key, row.label) }}
                    </div>
                  </td>
                  <td class="px-1 py-1.5 text-center tabular-nums">
                    {{ formatPct(row.killRate) }}
                  </td>
                  <td class="px-1 py-1.5 text-center tabular-nums">
                    {{ formatPct(row.assistRate) }}
                  </td>
                  <td class="py-1.5 pl-1 text-center tabular-nums">
                    {{ formatPct(row.soloRate) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul class="space-y-2 text-sm text-text/80 md:hidden">
            <li
              v-for="row in objectiveRows"
              :key="'mob-' + row.key"
              class="rounded border border-primary/20 bg-black/10 px-2 py-2"
            >
              <div class="mb-1 flex items-center gap-1 font-medium text-text/90">
                <img
                  v-if="objectiveIconSrc(row.key)"
                  :src="objectiveIconSrc(row.key)"
                  :alt="objectiveLabel(row.key, row.label)"
                  class="h-4 w-4 object-contain"
                  loading="lazy"
                  decoding="async"
                  @error="onObjectiveIconError($event, row.key)"
                />
                {{ objectiveLabel(row.key, row.label) }}
              </div>
              <div class="grid grid-cols-3 gap-1 text-center text-xs">
                <div>
                  <div class="text-text/50">{{ t('statisticsPage.objectiveKillRate') }}</div>
                  <div class="font-semibold tabular-nums">{{ formatPct(row.killRate) }}</div>
                </div>
                <div>
                  <div class="text-text/50">{{ t('statisticsPage.objectiveAssistRate') }}</div>
                  <div class="font-semibold tabular-nums">{{ formatPct(row.assistRate) }}</div>
                </div>
                <div>
                  <div class="text-text/50">{{ t('statisticsPage.objectiveSoloRate') }}</div>
                  <div class="font-semibold tabular-nums">{{ formatPct(row.soloRate) }}</div>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <div
          v-else-if="panelTab === 'objectives' && displayMode === 'winrate'"
          class="w-full min-w-0"
        >
          <div class="hidden min-w-0 overflow-x-auto md:block">
            <table class="objectives-zebra-cols w-full min-w-[400px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.championObjectivesColName') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">
                    {{ t('statisticsPage.objectiveWinrateWhenTaken') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr v-for="row in objectiveRows" :key="'wr-' + row.key">
                  <td class="py-1.5 pr-2">
                    <div class="flex items-center gap-1 font-medium text-text/90">
                      <img
                        v-if="objectiveIconSrc(row.key)"
                        :src="objectiveIconSrc(row.key)"
                        :alt="objectiveLabel(row.key, row.label)"
                        class="h-4 w-4 object-contain"
                        loading="lazy"
                        decoding="async"
                        @error="onObjectiveIconError($event, row.key)"
                      />
                      {{ objectiveLabel(row.key, row.label) }}
                    </div>
                  </td>
                  <td class="py-1.5 pl-1 text-center font-semibold tabular-nums text-accent">
                    {{ formatPct(row.objectiveWinrate) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="space-y-2 text-sm text-text/80 md:hidden">
            <li
              v-for="row in objectiveRows"
              :key="'mob-wr-' + row.key"
              class="flex items-center justify-between rounded border border-primary/20 bg-black/10 px-2 py-2"
            >
              <span class="font-medium text-text/90">{{ objectiveLabel(row.key, row.label) }}</span>
              <span class="font-semibold tabular-nums text-accent">{{
                formatPct(row.objectiveWinrate)
              }}</span>
            </li>
          </ul>
        </div>

        <!-- Drake types : tableau répartition -->
        <div v-else-if="panelTab === 'drakeTypes'" class="w-full min-w-0">
          <div class="hidden min-w-0 overflow-x-auto md:block">
            <table class="objectives-zebra-cols w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.objectivesDrakeDistributionCardTitle') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">
                    {{ t('statisticsPage.objectivesOccurrences') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">%</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr v-for="row in drakeDistRows" :key="'dt-' + row.key">
                  <td class="py-1.5 pr-2">
                    <span class="inline-flex items-center gap-2 font-medium text-text/90">
                      <span
                        class="h-2.5 w-2.5 rounded-full"
                        :style="{ backgroundColor: row.color }"
                      />
                      <img
                        v-if="drakeIconSrc(row.key)"
                        :src="drakeIconSrc(row.key)"
                        :alt="row.label"
                        class="h-4 w-4 object-contain"
                        loading="lazy"
                        decoding="async"
                        @error="onDrakeIconError($event, row.key)"
                      />
                      {{ row.label }}
                    </span>
                  </td>
                  <td class="px-1 py-1.5 text-center tabular-nums">{{ row.value }}</td>
                  <td class="py-1.5 pl-1 text-center font-semibold tabular-nums text-accent">
                    {{ distPct(row.value, drakeDistTotal) }}
                  </td>
                </tr>
                <tr v-if="drakeDistRows.length === 0">
                  <td colspan="3" class="py-2 text-center text-text/60">
                    {{ t('statisticsPage.noData') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Souls -->
        <div v-else-if="panelTab === 'drakeSouls'" class="w-full min-w-0">
          <div class="hidden min-w-0 overflow-x-auto md:block">
            <table class="objectives-zebra-cols w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.objectivesSoulDistributionCardTitle') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">
                    {{ t('statisticsPage.objectivesOccurrences') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">%</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr v-for="row in soulDistRows" :key="'soul-' + row.key">
                  <td class="py-1.5 pr-2">
                    <span class="inline-flex items-center gap-2 font-medium text-text/90">
                      <span
                        class="h-2.5 w-2.5 rounded-full"
                        :style="{ backgroundColor: row.color }"
                      />
                      <img
                        v-if="drakeIconSrc(row.key)"
                        :src="drakeIconSrc(row.key)"
                        :alt="row.label"
                        class="h-4 w-4 object-contain"
                        loading="lazy"
                        decoding="async"
                        @error="onDrakeIconError($event, row.key)"
                      />
                      {{ row.label }}
                    </span>
                  </td>
                  <td class="px-1 py-1.5 text-center tabular-nums">{{ row.value }}</td>
                  <td class="py-1.5 pl-1 text-center font-semibold tabular-nums text-accent">
                    {{ distPct(row.value, soulDistTotal) }}
                  </td>
                </tr>
                <tr v-if="soulDistRows.length === 0">
                  <td colspan="3" class="py-2 text-center text-text/60">
                    {{ t('statisticsPage.noData') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="showDistributionCards" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          class="fast-stat-card fast-stat-card-distribution mx-auto w-full max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3"
        >
          <h4 class="mb-2 text-sm font-semibold text-text/90">
            {{ t('statisticsPage.objectivesDrakeDistributionCardTitle') }}
          </h4>
          <ChampionObjectivesDonut
            :rows="drakeDistRows"
            :total="drakeDistTotal"
            :empty-label="t('statisticsPage.noData')"
          />
        </div>
        <div
          class="fast-stat-card fast-stat-card-distribution mx-auto w-full max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3"
        >
          <h4 class="mb-2 text-sm font-semibold text-text/90">
            {{ t('statisticsPage.objectivesSoulDistributionCardTitle') }}
          </h4>
          <ChampionObjectivesDonut
            :rows="soulDistRows"
            :total="soulDistTotal"
            :empty-label="t('statisticsPage.noData')"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChampionObjectivesDonut from '~/components/statistics/ChampionObjectivesDonut.vue'
import {
  scoreboardDrakeIconByKey,
  scoreboardDrakeIconCdByKey,
  scoreboardObjectiveIconByKey,
  scoreboardObjectiveIconCdByKey,
} from '~/utils/objectiveScoreboardIcons'

export type ChampionObjectivesParticipationCard = {
  stealPct: number
  stealWithoutSmitePct: number
  soloBaronPct: number
  soloEpicObjectivePct: number
}

export type ChampionObjectivesRow = {
  key: string
  label: string
  objectiveWinrate: number
  killRate: number
  assistRate: number
  soloRate: number
}

export type ChampionObjectivesDistributionEntry = {
  key: string
  label: string
  total: number
  pct: number
}

export type ChampionObjectivesSummary = {
  games?: number
  winrate?: number
  rows?: ChampionObjectivesRow[]
  participationCard?: ChampionObjectivesParticipationCard
  drakeTypeDistribution?: ChampionObjectivesDistributionEntry[]
  soulDistribution?: ChampionObjectivesDistributionEntry[]
}

const props = defineProps<{
  data: ChampionObjectivesSummary | null
  pending?: boolean
}>()

const { t, te } = useI18n()

const panelTab = ref<'objectives' | 'drakeTypes' | 'drakeSouls'>('objectives')
const displayMode = ref<'obtention' | 'winrate'>('obtention')

const DONUT_COLORS: Record<string, string> = {
  elder: '#7c3aed',
  earth: '#f59e0b',
  water: '#14b8a6',
  wind: '#eff6ff',
  fire: '#ef4444',
  hextec: '#00e5ff',
  chem: '#22c55e',
}

type DistRow = { key: string; label: string; value: number; color: string }

const games = computed(() => Number(props.data?.games ?? 0))
const winrate = computed(() => Number(props.data?.winrate ?? 0))
const hasData = computed(() => games.value > 0 && objectiveRows.value.length > 0)

const objectiveRows = computed(() =>
  (props.data?.rows ?? []).filter(r => r && typeof r.key === 'string')
)

const participationCard = computed(
  () =>
    props.data?.participationCard ?? {
      stealPct: 0,
      stealWithoutSmitePct: 0,
      soloBaronPct: 0,
      soloEpicObjectivePct: 0,
    }
)

const participationMetrics = computed(() => {
  const c = participationCard.value
  return [
    { key: 'steal', label: t('statisticsPage.championObjectivesStealPct'), value: c.stealPct },
    {
      key: 'stealNoSmite',
      label: t('statisticsPage.championObjectivesStealNoSmitePct'),
      value: c.stealWithoutSmitePct,
    },
    {
      key: 'soloBaron',
      label: t('statisticsPage.championObjectivesSoloBaronPct'),
      value: c.soloBaronPct,
    },
    {
      key: 'soloEpic',
      label: t('statisticsPage.championObjectivesSoloEpicPct'),
      value: c.soloEpicObjectivePct,
    },
  ]
})

function rowColor(key: string): string {
  return DONUT_COLORS[key] ?? '#64748b'
}

function buildDistRows(entries: ChampionObjectivesDistributionEntry[]): DistRow[] {
  return entries
    .filter(d => Number(d.total) > 0)
    .map(d => ({
      key: d.key,
      label: drakeTypeLabel(d.key, d.label),
      value: Number(d.total),
      color: rowColor(d.key),
    }))
}

const drakeDistRows = computed(() => buildDistRows(props.data?.drakeTypeDistribution ?? []))
const soulDistRows = computed(() => buildDistRows(props.data?.soulDistribution ?? []))
const showDistributionCards = computed(
  () => drakeDistRows.value.length > 0 || soulDistRows.value.length > 0
)

function distTotal(rows: DistRow[]): number {
  return rows.reduce((sum, row) => sum + row.value, 0)
}

const drakeDistTotal = computed(() => distTotal(drakeDistRows.value))
const soulDistTotal = computed(() => distTotal(soulDistRows.value))

function distPct(value: number, total: number): string {
  if (!total) return '—'
  return `${((value / total) * 100).toFixed(2)}%`
}

function formatPct(n: number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(2)}%`
}

function objectiveLabel(key: string, fallback: string): string {
  const i18nKey = `statisticsPage.championObjective_${key}`
  return te(i18nKey) ? t(i18nKey) : fallback
}

function drakeTypeLabel(key: string, fallback: string): string {
  const map: Record<string, string> = {
    earth: 'statisticsPage.drakeTypeEarth',
    water: 'statisticsPage.drakeTypeWater',
    wind: 'statisticsPage.drakeTypeWind',
    fire: 'statisticsPage.drakeTypeFire',
    hextec: 'statisticsPage.drakeTypeHextec',
    chem: 'statisticsPage.drakeTypeChem',
    elder: 'statisticsPage.championObjective_elder',
  }
  const i18nKey = map[key]
  return i18nKey && te(i18nKey) ? t(i18nKey) : fallback
}

function objectiveIconSrc(key: string): string | undefined {
  return scoreboardObjectiveIconByKey[key]
}

function drakeIconSrc(key: string): string | undefined {
  return scoreboardDrakeIconByKey[key]
}

function onObjectiveIconError(e: Event, key: string): void {
  const el = e.target as HTMLImageElement
  if (el.dataset.cdFallback === '1') return
  const url = scoreboardObjectiveIconCdByKey[key]
  if (url) {
    el.dataset.cdFallback = '1'
    el.src = url
  }
}

function onDrakeIconError(e: Event, key: string): void {
  const el = e.target as HTMLImageElement
  if (el.dataset.cdFallback === '1') return
  const url = scoreboardDrakeIconCdByKey[key]
  if (url) {
    el.dataset.cdFallback = '1'
    el.src = url
  }
}
</script>

<style scoped>
.objectives-zebra-cols th:nth-child(even),
.objectives-zebra-cols td:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.04);
}
</style>
