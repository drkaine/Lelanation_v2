<template>
  <div class="champion-objectives-tab w-full min-w-0 max-w-full space-y-4">
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
          <div class="ml-auto inline-flex overflow-hidden rounded border border-primary/30 text-xs">
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

        <div v-if="panelTab === 'objectives' && displayMode === 'obtention'" class="w-full min-w-0">
          <div class="hidden min-w-0 overflow-x-auto md:block">
            <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.overviewTeamsObjective') }}
                  </th>
                  <th class="px-1 py-1.5 text-center font-medium">
                    {{ t('statisticsPage.overviewTeamsFirstByWin') }}
                  </th>
                  <th class="px-1 py-1.5 text-center font-medium">
                    {{ t('statisticsPage.overviewTeamsFirstByLoss') }}
                  </th>
                  <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                    {{ t('statisticsPage.sidesBlue') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                    {{ t('statisticsPage.sidesRed') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <template v-for="row in mainTableRows" :key="'obt-' + row.key">
                  <tr>
                    <td class="py-1.5 pr-2">
                      <button
                        v-if="objectiveHasKillDropdown(row.key)"
                        type="button"
                        class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                        @click="toggleObjective(row.key)"
                      >
                        <span
                          class="inline-block transition-transform duration-200"
                          :class="openObjectiveKeys.has(row.key) ? 'rotate-180' : ''"
                          aria-hidden
                          >▼</span
                        >
                        <img
                          v-if="objectiveIconSrc(row.key)"
                          :src="objectiveIconSrc(row.key)"
                          :alt="rowTitle(row)"
                          class="h-4 w-4 object-contain"
                          loading="lazy"
                          decoding="async"
                          @error="onObjectiveIconError($event, row.key)"
                        />
                        {{ rowTitle(row) }}
                      </button>
                      <div v-else class="flex items-center gap-1 font-medium text-text/90">
                        <img
                          v-if="objectiveIconSrc(row.key)"
                          :src="objectiveIconSrc(row.key)"
                          :alt="rowTitle(row)"
                          class="h-4 w-4 object-contain"
                          loading="lazy"
                          decoding="async"
                          @error="onObjectiveIconError($event, row.key)"
                        />
                        {{ rowTitle(row) }}
                      </div>
                    </td>
                    <td class="px-1 py-1.5 text-center tabular-nums">
                      {{ formatPct(row.firstByWin) }}
                    </td>
                    <td class="px-1 py-1.5 text-center tabular-nums">
                      {{ formatPct(row.firstByLoss) }}
                    </td>
                    <td class="px-1 py-1.5 text-center tabular-nums">
                      {{ formatPct(row.blue) }}
                    </td>
                    <td class="py-1.5 pl-1 text-center tabular-nums">
                      {{ formatPct(row.red) }}
                    </td>
                  </tr>
                  <template
                    v-if="objectiveHasKillDropdown(row.key) && openObjectiveKeys.has(row.key)"
                  >
                    <tr
                      v-for="count in objectiveKillCounts(row.key)"
                      :key="row.key + '-k-' + count"
                      class="bg-surface/30"
                    >
                      <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                      <td colspan="4" class="px-1 py-1 text-center tabular-nums text-text/80">
                        {{ percentForKillCount(row.key, count) }}
                      </td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </div>
          <ul class="statistics-objectives-mobile-list space-y-3 md:hidden">
            <li
              v-for="row in mainTableRows"
              :key="'mob-obt-' + row.key"
              class="rounded border border-primary/20 bg-black/10 px-2 py-2 text-sm text-text/80"
            >
              <div class="mb-1 font-medium text-text/90">{{ rowTitle(row) }}</div>
              <div class="grid grid-cols-2 gap-1 text-center text-xs">
                <div>
                  <div class="text-text/50">{{ t('statisticsPage.overviewTeamsFirstByWin') }}</div>
                  <div class="font-semibold tabular-nums">{{ formatPct(row.firstByWin) }}</div>
                </div>
                <div>
                  <div class="text-text/50">{{ t('statisticsPage.overviewTeamsFirstByLoss') }}</div>
                  <div class="font-semibold tabular-nums">{{ formatPct(row.firstByLoss) }}</div>
                </div>
                <div>
                  <div class="text-text/50">{{ t('statisticsPage.sidesBlue') }}</div>
                  <div class="font-semibold tabular-nums">{{ formatPct(row.blue) }}</div>
                </div>
                <div>
                  <div class="text-text/50">{{ t('statisticsPage.sidesRed') }}</div>
                  <div class="font-semibold tabular-nums">{{ formatPct(row.red) }}</div>
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
            <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.overviewTeamsObjective') }}
                  </th>
                  <th class="px-1 py-1.5 text-center font-medium">
                    {{ t('statisticsPage.objectivesFirstWinrateColGlobal') }}
                  </th>
                  <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                    {{ t('statisticsPage.sidesBlue') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                    {{ t('statisticsPage.sidesRed') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <template v-for="row in mainTableRows" :key="'wr-' + row.key">
                  <tr>
                    <td class="py-1.5 pr-2">
                      <button
                        v-if="objectiveHasKillDropdown(row.key)"
                        type="button"
                        class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                        @click="toggleObjective(row.key)"
                      >
                        <span
                          class="inline-block transition-transform duration-200"
                          :class="openObjectiveKeys.has(row.key) ? 'rotate-180' : ''"
                          aria-hidden
                          >▼</span
                        >
                        <img
                          v-if="objectiveIconSrc(row.key)"
                          :src="objectiveIconSrc(row.key)"
                          :alt="rowTitle(row)"
                          class="h-4 w-4 object-contain"
                          loading="lazy"
                          decoding="async"
                          @error="onObjectiveIconError($event, row.key)"
                        />
                        {{ rowTitle(row) }}
                      </button>
                      <div v-else class="flex items-center gap-1 font-medium text-text/90">
                        <img
                          v-if="objectiveIconSrc(row.key)"
                          :src="objectiveIconSrc(row.key)"
                          :alt="rowTitle(row)"
                          class="h-4 w-4 object-contain"
                          loading="lazy"
                          decoding="async"
                          @error="onObjectiveIconError($event, row.key)"
                        />
                        {{ rowTitle(row) }}
                      </div>
                    </td>
                    <td class="px-1 py-1.5 text-center font-semibold tabular-nums text-accent">
                      {{ formatPct(row.objectiveWinrate) }}
                    </td>
                    <td class="px-1 py-1.5 text-center tabular-nums text-text/80">
                      {{ formatPct(row.winrateBlue) }}
                    </td>
                    <td class="py-1.5 pl-1 text-center tabular-nums text-text/80">
                      {{ formatPct(row.winrateRed) }}
                    </td>
                  </tr>
                  <template
                    v-if="objectiveHasKillDropdown(row.key) && openObjectiveKeys.has(row.key)"
                  >
                    <tr
                      v-for="count in objectiveKillCounts(row.key)"
                      :key="'wr-k-' + row.key + count"
                      class="bg-surface/30"
                    >
                      <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                      <td colspan="3" class="px-1 py-1 text-center tabular-nums text-text/80">
                        {{ percentForKillCount(row.key, count) }}
                      </td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </div>
          <ul class="statistics-objectives-mobile-list space-y-3 md:hidden">
            <li
              v-for="row in mainTableRows"
              :key="'mob-wr-' + row.key"
              class="flex items-center justify-between rounded border border-primary/20 bg-black/10 px-2 py-2 text-sm text-text/80"
            >
              <span class="font-medium text-text/90">{{ rowTitle(row) }}</span>
              <span class="font-semibold tabular-nums text-accent">{{
                formatPct(row.objectiveWinrate)
              }}</span>
            </li>
          </ul>
        </div>

        <div v-else-if="panelTab === 'drakeTypes'" class="w-full min-w-0">
          <div class="hidden min-w-0 overflow-x-auto md:block">
            <table class="objectives-zebra-cols w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.overviewTeamsObjective') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">
                    {{
                      displayMode === 'obtention'
                        ? t('statisticsPage.championObjectivesGamePct')
                        : t('statisticsPage.objectivesTabFirstWinrate')
                    }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr v-for="row in drakeTypeRows" :key="'dt-' + row.key">
                  <td class="py-1.5 pr-2">
                    <span class="inline-flex items-center gap-2 font-medium text-text/90">
                      <span
                        class="h-2.5 w-2.5 rounded-full"
                        :style="{ backgroundColor: rowColor(row.key) }"
                      />
                      <img
                        v-if="drakeIconSrc(row.key)"
                        :src="drakeIconSrc(row.key)"
                        :alt="drakeTypeLabel(row.key, row.label)"
                        class="h-4 w-4 object-contain"
                        loading="lazy"
                        decoding="async"
                        @error="onDrakeIconError($event, row.key)"
                      />
                      {{ drakeTypeLabel(row.key, row.label) }}
                    </span>
                  </td>
                  <td class="py-1.5 pl-1 text-center font-semibold tabular-nums text-accent">
                    {{
                      displayMode === 'obtention'
                        ? formatPct(row.gamePct)
                        : formatPct(row.objectiveWinrate)
                    }}
                  </td>
                </tr>
                <tr v-if="drakeTypeRows.length === 0">
                  <td colspan="2" class="py-2 text-center text-text/60">
                    {{ t('statisticsPage.noData') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="statistics-objectives-mobile-list space-y-3 md:hidden">
            <li
              v-for="row in drakeTypeRows"
              :key="'mob-dt-' + row.key"
              class="flex items-center justify-between rounded border border-primary/20 bg-black/10 px-2 py-2 text-sm text-text/80"
            >
              <span class="font-medium text-text/90">{{ drakeTypeLabel(row.key, row.label) }}</span>
              <span class="font-semibold tabular-nums text-accent">{{
                displayMode === 'obtention'
                  ? formatPct(row.gamePct)
                  : formatPct(row.objectiveWinrate)
              }}</span>
            </li>
          </ul>
        </div>

        <div v-else-if="panelTab === 'drakeSouls'" class="w-full min-w-0">
          <div class="hidden min-w-0 overflow-x-auto md:block">
            <table class="objectives-zebra-cols w-full min-w-[360px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ t('statisticsPage.overviewTeamsObjective') }}
                  </th>
                  <th class="py-1.5 pl-1 text-center font-medium">
                    {{
                      displayMode === 'obtention'
                        ? t('statisticsPage.championObjectivesGamePct')
                        : t('statisticsPage.objectivesTabFirstWinrate')
                    }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr v-for="row in soulRows" :key="'soul-' + row.key">
                  <td class="py-1.5 pr-2">
                    <span class="inline-flex items-center gap-2 font-medium text-text/90">
                      <span
                        class="h-2.5 w-2.5 rounded-full"
                        :style="{ backgroundColor: rowColor(row.key) }"
                      />
                      <img
                        v-if="drakeIconSrc(row.key)"
                        :src="drakeIconSrc(row.key)"
                        :alt="drakeTypeLabel(row.key, row.label)"
                        class="h-4 w-4 object-contain"
                        loading="lazy"
                        decoding="async"
                        @error="onDrakeIconError($event, row.key)"
                      />
                      {{ drakeTypeLabel(row.key, row.label) }}
                    </span>
                  </td>
                  <td class="py-1.5 pl-1 text-center font-semibold tabular-nums text-accent">
                    {{
                      displayMode === 'obtention'
                        ? formatPct(row.gamePct)
                        : formatPct(row.objectiveWinrate)
                    }}
                  </td>
                </tr>
                <tr v-if="soulRows.length === 0">
                  <td colspan="2" class="py-2 text-center text-text/60">
                    {{ t('statisticsPage.noData') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul class="statistics-objectives-mobile-list space-y-3 md:hidden">
            <li
              v-for="row in soulRows"
              :key="'mob-soul-' + row.key"
              class="flex items-center justify-between rounded border border-primary/20 bg-black/10 px-2 py-2 text-sm text-text/80"
            >
              <span class="font-medium text-text/90">{{ drakeTypeLabel(row.key, row.label) }}</span>
              <span class="font-semibold tabular-nums text-accent">{{
                displayMode === 'obtention'
                  ? formatPct(row.gamePct)
                  : formatPct(row.objectiveWinrate)
              }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div
        v-if="panelTab === 'objectives' && participationMetrics.length > 0"
        class="fast-stat-card w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <h4 class="mb-3 text-sm font-semibold text-text/90">
          {{ t('statisticsPage.championObjectivesParticipationTitle') }}
        </h4>
        <ul class="grid gap-2.5 text-xs text-text/85 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="metric in participationMetrics"
            :key="metric.key"
            class="flex items-start justify-between gap-3 rounded border border-primary/15 bg-black/10 px-2 py-1.5"
          >
            <span class="min-w-0 leading-snug text-text/70">{{ metric.label }}</span>
            <span class="shrink-0 font-semibold tabular-nums text-accent">
              {{ formatPct(metric.value) }}
            </span>
          </li>
        </ul>
      </div>

      <div
        v-if="panelTab === 'objectives' && structureMetrics.length > 0"
        class="fast-stat-card w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <h4 class="mb-3 text-sm font-semibold text-text/90">
          {{ t('statisticsPage.championObjectivesStructureTitle') }}
        </h4>
        <ul class="grid gap-2.5 text-xs text-text/85 sm:grid-cols-2 lg:grid-cols-3">
          <li
            v-for="metric in structureMetrics"
            :key="metric.key"
            class="flex items-start justify-between gap-3 rounded border border-primary/15 bg-black/10 px-2 py-1.5"
          >
            <span class="min-w-0 leading-snug text-text/70">{{ metric.label }}</span>
            <span class="shrink-0 font-semibold tabular-nums text-accent">
              {{ formatNumber(metric.value) }}
            </span>
          </li>
        </ul>
      </div>

      <div
        v-if="showDistributionCards"
        class="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 md:grid-cols-2"
      >
        <div
          class="fast-stat-card fast-stat-card-distribution mx-auto w-full min-w-0 max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3 max-lg:max-w-full"
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
          class="fast-stat-card fast-stat-card-distribution mx-auto w-full min-w-0 max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3 max-lg:max-w-full"
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
  stealWithSmitePct: number
  stealWithoutSmitePct: number
  soloBaronPct: number
  soloTowerPct: number
  soloDragonPct: number
  soloRiftHeraldPct: number
  soloHordePct: number
  soloInhibitorPct: number
  soloKillPct: number
  soloEpicObjectivePct: number
}

export type ChampionObjectivesStructureCard = {
  damageToTurretsPerGame: number
  damageToObjectivesPerGame: number
  damageToBuildingsPerGame: number
  turretsDestroyedPerGame: number
  turretsTakenWithHeraldPerGame: number
}

export type ChampionObjectivesRow = {
  key: string
  label: string
  firstByWin: number
  firstByLoss: number
  blue: number
  red: number
  objectiveWinrate: number
  winrateBlue: number
  winrateRed: number
}

export type ChampionObjectivesDistributionEntry = {
  key: string
  label: string
  total: number
  pct: number
}

export type ChampionObjectivesTypedRow = {
  key: string
  label: string
  gamePct: number
  objectiveWinrate: number
}

export type ChampionObjectivesSummary = {
  games?: number
  winrate?: number
  rows?: ChampionObjectivesRow[]
  participationCard?: ChampionObjectivesParticipationCard
  structureCard?: ChampionObjectivesStructureCard
  drakeTypeDistribution?: ChampionObjectivesDistributionEntry[]
  soulDistribution?: ChampionObjectivesDistributionEntry[]
  drakeTypeRows?: ChampionObjectivesTypedRow[]
  soulRows?: ChampionObjectivesTypedRow[]
  killHistograms?: Record<string, Record<string, number>>
}

const props = defineProps<{
  data: ChampionObjectivesSummary | null
  pending?: boolean
}>()

const { t, te } = useI18n()

const panelTab = ref<'objectives' | 'drakeTypes' | 'drakeSouls'>('objectives')
const displayMode = ref<'obtention' | 'winrate'>('obtention')
const openObjectiveKeys = ref<Set<string>>(new Set())

const objectiveKeysOrdered = [
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const

const OBJECTIVE_KEYS_WITH_KILL_DROPDOWN = new Set([
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'horde',
])

const HORDE_DISPLAY_MAX = 3
const RIFT_HERALD_DISPLAY_MAX = 1

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
const hasData = computed(() => games.value > 0 && (props.data?.rows?.length ?? 0) > 0)

const objectiveRows = computed(() =>
  (props.data?.rows ?? []).filter(r => r && typeof r.key === 'string' && r.key !== 'elder')
)

const rowByKey = (key: string): ChampionObjectivesRow | undefined =>
  objectiveRows.value.find(r => r.key === key)

/** Ordre aligné stats globales : first blood puis baron → dragon → tour → inhib → héraut → grubs. */
const mainTableRows = computed(() => {
  const out: ChampionObjectivesRow[] = []
  const fb = rowByKey('firstBlood')
  if (fb) out.push(fb)
  for (const key of objectiveKeysOrdered) {
    const row = rowByKey(key)
    if (row) out.push(row)
  }
  return out
})

const drakeTypeRows = computed(() => {
  const fromApi = props.data?.drakeTypeRows ?? []
  if (fromApi.length > 0) return fromApi
  const elder = props.data?.rows?.find(r => r.key === 'elder')
  if (!elder) return []
  return [
    {
      key: 'elder',
      label: 'Elder Dragon',
      gamePct: 0,
      objectiveWinrate: elder.objectiveWinrate,
    },
  ]
})
const soulRows = computed(() => props.data?.soulRows ?? [])

function toggleObjective(key: string) {
  const next = new Set(openObjectiveKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openObjectiveKeys.value = next
}

function objectiveHasKillDropdown(key: string): boolean {
  return OBJECTIVE_KEYS_WITH_KILL_DROPDOWN.has(key)
}

function objectiveKillCounts(key: string): string[] {
  const hist = props.data?.killHistograms?.[key]
  if (!hist) return []
  const capHorde = key === 'horde'
  const capHerald = key === 'riftHerald'
  const labels = new Set<string>()
  for (const [label, n] of Object.entries(hist)) {
    if (Number(n ?? 0) <= 0) continue
    let display = label
    const num = label === '3+' || label.endsWith('+') ? 99 : Number.parseInt(label, 10) || 0
    if (capHorde && num > HORDE_DISPLAY_MAX) display = String(HORDE_DISPLAY_MAX)
    if (capHerald && num > RIFT_HERALD_DISPLAY_MAX) display = String(RIFT_HERALD_DISPLAY_MAX)
    labels.add(display)
  }
  return [...labels].sort((a, b) => {
    const na = a === '3+' || a.endsWith('+') ? 99 : Number.parseInt(a, 10) || 0
    const nb = b === '3+' || b.endsWith('+') ? 99 : Number.parseInt(b, 10) || 0
    return na - nb
  })
}

function percentForKillCount(key: string, label: string): string {
  const total = games.value
  if (!total) return '—'
  const n = Number(props.data?.killHistograms?.[key]?.[label] ?? 0)
  if (n <= 0) return '—'
  return `${((100 * n) / total).toFixed(2)}%`
}

const participationCard = computed(() => props.data?.participationCard)
const structureCard = computed(() => props.data?.structureCard)

const participationMetrics = computed(() => {
  const c = participationCard.value
  if (!c) return []
  return [
    { key: 'steal', label: t('statisticsPage.championObjectivesStealPct'), value: c.stealPct },
    {
      key: 'stealSmite',
      label: t('statisticsPage.championObjectivesStealWithSmitePct'),
      value: c.stealWithSmitePct,
    },
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
      key: 'soloTower',
      label: t('statisticsPage.championObjectivesSoloTowerPct'),
      value: c.soloTowerPct,
    },
    {
      key: 'soloDragon',
      label: t('statisticsPage.championObjectivesSoloDragonPct'),
      value: c.soloDragonPct,
    },
    {
      key: 'soloHerald',
      label: t('statisticsPage.championObjectivesSoloHeraldPct'),
      value: c.soloRiftHeraldPct,
    },
    {
      key: 'soloHorde',
      label: t('statisticsPage.championObjectivesSoloHordePct'),
      value: c.soloHordePct,
    },
    {
      key: 'soloInhib',
      label: t('statisticsPage.championObjectivesSoloInhibitorPct'),
      value: c.soloInhibitorPct,
    },
    {
      key: 'soloKill',
      label: t('statisticsPage.championObjectivesSoloKillPct'),
      value: c.soloKillPct,
    },
    {
      key: 'soloEpic',
      label: t('statisticsPage.championObjectivesSoloEpicPct'),
      value: c.soloEpicObjectivePct,
    },
  ]
})

const structureMetrics = computed(() => {
  const s = structureCard.value
  if (!s) return []
  return [
    {
      key: 'dmgTurret',
      label: t('statisticsPage.championObjectivesDamageTurrets'),
      value: s.damageToTurretsPerGame,
    },
    {
      key: 'dmgObj',
      label: t('statisticsPage.championObjectivesDamageObjectives'),
      value: s.damageToObjectivesPerGame,
    },
    {
      key: 'dmgBuild',
      label: t('statisticsPage.championObjectivesDamageBuildings'),
      value: s.damageToBuildingsPerGame,
    },
    {
      key: 'turrets',
      label: t('statisticsPage.championObjectivesTurretsPerGame'),
      value: s.turretsDestroyedPerGame,
    },
    {
      key: 'heraldTurrets',
      label: t('statisticsPage.championObjectivesTurretsWithHerald'),
      value: s.turretsTakenWithHeraldPerGame,
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

function formatPct(n: number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(2)}%`
}

function formatNumber(n: number): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function objectiveLabel(key: string, fallback: string): string {
  const globalKey = `statisticsPage.overviewTeamsObjective_${key}`
  if (te(globalKey)) return t(globalKey)
  const i18nKey = `statisticsPage.championObjective_${key}`
  return te(i18nKey) ? t(i18nKey) : fallback
}

function rowTitle(row: ChampionObjectivesRow): string {
  if (row.key === 'firstBlood') return t('statisticsPage.overviewTeamsFirstBlood')
  return objectiveLabel(row.key, row.label)
}

function drakeTypeLabel(key: string, fallback: string): string {
  if (key === 'elder') {
    const i18nKey = 'statisticsPage.championObjective_elder'
    return te(i18nKey) ? t(i18nKey) : fallback
  }
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
