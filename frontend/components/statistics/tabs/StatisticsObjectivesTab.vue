<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'

const p = inject('statisticsPageCtx') as any
const tooltipsEnabled = inject('tooltipsEnabled', ref(true)) as Ref<boolean>

function syncToggleObjective(key: string) {
  p.toggleObjective(key)
  p.toggleSidesObjective(key)
}

function sidesDrakeSoulByKey(key: string): { byBlue: number; byRed: number } {
  const row = p.sidesDrakeSoulRows.find((r: { key: string }) => r.key === key)
  return row ? { byBlue: row.byBlue, byRed: row.byRed } : { byBlue: 0, byRed: 0 }
}

function pct(count: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  return (Number(count) / total) * 100
}

function formatPct(value: number | null): string {
  if (value == null) return '—'
  return `${value.toFixed(2)}%`
}

function formatDelta(value: number | null): string {
  if (value == null) return ''
  const sign = value > 0 ? '+' : ''
  return `(${sign}${value.toFixed(2)} %)`
}

function deltaColorClass(delta: number | null): string {
  if (delta == null || delta === 0) return 'text-text/80'
  return delta > 0 ? 'text-emerald-400' : 'text-rose-400'
}

function teamFirstPctParts(
  objectiveKey: string,
  side: 'win' | 'loss'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0)
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curObj = curData.objectives?.[objectiveKey] ?? {}
  const curCount = side === 'win' ? Number(curObj.firstByWin ?? 0) : Number(curObj.firstByLoss ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))
  const baseData = p.overviewTeamsBaselineData
  const baseObj = baseData?.objectives?.[objectiveKey] ?? null
  const baseCount =
    baseObj == null
      ? null
      : side === 'win'
        ? Number(baseObj.firstByWin ?? 0)
        : Number(baseObj.firstByLoss ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function sideFirstPctParts(
  objectiveKey: string,
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewSidesData
  if (!curData || curData.matchCount <= 0)
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curObj = curData.objectivesBySideTable?.[objectiveKey] ?? {}
  const curCount =
    side === 'blue' ? Number(curObj.firstByBlue ?? 0) : Number(curObj.firstByRed ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))
  const baseData = p.overviewSidesBaselineData
  const baseObj = baseData?.objectivesBySideTable?.[objectiveKey] ?? null
  const baseCount =
    baseObj == null
      ? null
      : side === 'blue'
        ? Number(baseObj.firstByBlue ?? 0)
        : Number(baseObj.firstByRed ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

const openDrakeTypeKeys = ref(new Set<string>())

function toggleDrakeType(key: string) {
  if (openDrakeTypeKeys.value.has(key)) openDrakeTypeKeys.value.delete(key)
  else openDrakeTypeKeys.value.add(key)
}

function drakeTypePctParts(
  key: string,
  side: 'win' | 'loss'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const curRow = p.drakeTypeRows.find((r: { key: string }) => r.key === key)
  const curCount = side === 'win' ? Number(curRow?.byWin ?? 0) : Number(curRow?.byLoss ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewTeamsBaselineData
  const baseDrakes = baseData?.drakes?.types?.[key]
  const baseCount =
    baseDrakes == null
      ? null
      : side === 'win'
        ? Number(baseDrakes.byWin ?? 0)
        : Number(baseDrakes.byLoss ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function drakeTypePctPartsSides(
  key: string,
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewSidesData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const curRow = p.sidesDrakeTypeRows.find((r: { key: string }) => r.key === key)
  const curCount = side === 'blue' ? Number(curRow?.byBlue ?? 0) : Number(curRow?.byRed ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewSidesBaselineData
  const baseDrakes = baseData?.drakesBySide?.types?.[key]
  const baseCount =
    baseDrakes == null
      ? null
      : side === 'blue'
        ? Number(baseDrakes.byBlue ?? 0)
        : Number(baseDrakes.byRed ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

const DONUT_RADIUS = 48
const DONUT_STROKE = 14
const DONUT_CIRCLE = 2 * Math.PI * DONUT_RADIUS

const DONUT_COLORS: Record<string, string> = {
  elder: '#7c3aed',
  earth: '#f59e0b',
  water: '#14b8a6',
  wind: '#eff6ff',
  fire: '#ef4444',
  hextec: '#00e5ff',
  chem: '#22c55e',
}

function rowColor(key: string): string {
  return DONUT_COLORS[key] ?? '#64748b'
}

type DistRow = { key: string; label: string; value: number; color: string }

function buildDistRows(
  rows: Array<{ key: string; label: string; byWin: number; byLoss: number }>
): DistRow[] {
  return rows
    .map(row => ({
      key: row.key,
      label: row.label,
      value: Number(row.byWin ?? 0) + Number(row.byLoss ?? 0),
      color: rowColor(row.key),
    }))
    .filter(row => row.value > 0)
}

const drakeDistRows = computed<DistRow[]>(() => buildDistRows(p.drakeTypeRows))
const soulDistRows = computed<DistRow[]>(() => buildDistRows(p.drakeSoulRows))

function distTotal(rows: DistRow[]): number {
  return rows.reduce((sum, row) => sum + row.value, 0)
}

function distPct(value: number, total: number): string {
  if (!total) return '—'
  return `${((value / total) * 100).toFixed(2)}%`
}

function donutSegments(rows: DistRow[]): Array<{ arc: number; offset: number; color: string }> {
  const total = distTotal(rows)
  if (!total) return []
  let offset = 0
  return rows.map(row => {
    const arc = DONUT_CIRCLE * (row.value / total)
    const segment = { arc, offset, color: row.color }
    offset += arc
    return segment
  })
}

const drakeDonutSegments = computed(() => donutSegments(drakeDistRows.value))
const soulDonutSegments = computed(() => donutSegments(soulDistRows.value))
const drakeDistTotal = computed(() => distTotal(drakeDistRows.value))
const soulDistTotal = computed(() => distTotal(soulDistRows.value))

function donutTooltip(row: DistRow, total: number): string {
  return `${row.label}: ${distPct(row.value, total)} (${row.value.toLocaleString()})`
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="
        (p.overviewTeamsPending && !(p.overviewTeamsData && p.overviewTeamsData.matchCount > 0)) ||
        (p.overviewSidesPending && !(p.overviewSidesData && p.overviewSidesData.matchCount > 0))
      "
      class="text-text/70"
    >
      {{ p.t('statisticsPage.loading') }}
    </div>

    <div
      v-else-if="
        !(p.overviewTeamsData && p.overviewTeamsData.matchCount > 0) &&
        !(p.overviewSidesData && p.overviewSidesData.matchCount > 0)
      "
      class="rounded border border-primary/30 bg-surface/50 p-4 text-sm text-text/70"
    >
      {{ p.t('statisticsPage.objectivesCombinedEmpty') }}
    </div>

    <div
      v-else
      class="fast-stat-card fast-stat-card-objectives w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
    >
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="shrink-0 text-base leading-none transition-colors"
          :class="
            p.cardIsFavorite('overview.objectives')
              ? 'text-amber-300 hover:text-amber-200'
              : 'text-text/45 grayscale hover:text-text/75'
          "
          :title="
            p.cardIsFavorite('overview.objectives') ? 'Retirer des favoris' : 'Ajouter aux favoris'
          "
          @click="
            p.toggleFavoriteCard(
              'overview.objectives',
              p.t('statisticsPage.overviewTeamsObjectives')
            )
          "
        >
          {{ p.cardIsFavorite('overview.objectives') ? '★' : '☆' }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-semibold transition-colors"
          :class="
            p.objectivesPanelTab === 'objectives'
              ? 'bg-accent text-background'
              : 'bg-black/20 text-text/80 hover:bg-white/10'
          "
          @click="p.setObjectivesPanelTab('objectives')"
        >
          {{ p.t('statisticsPage.objectivesTabMain') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-semibold transition-colors"
          :class="
            p.objectivesPanelTab === 'drakeTypes'
              ? 'bg-accent text-background'
              : 'bg-black/20 text-text/80 hover:bg-white/10'
          "
          @click="p.setObjectivesPanelTab('drakeTypes')"
        >
          {{ p.t('statisticsPage.objectivesTabDrakeTypes') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-semibold transition-colors"
          :class="
            p.objectivesPanelTab === 'drakeSouls'
              ? 'bg-accent text-background'
              : 'bg-black/20 text-text/80 hover:bg-white/10'
          "
          @click="p.setObjectivesPanelTab('drakeSouls')"
        >
          {{ p.t('statisticsPage.objectivesTabSouls') }}
        </button>
        <span
          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
          :aria-label="p.t('statisticsPage.tooltipOverviewObjectives')"
        >
          ⓘ
          <span
            role="tooltip"
            class="fast-stat-tooltip-popover fast-stat-tooltip-popover--objectives hidden group-hover/stat-tip:block"
          >
            {{ p.t('statisticsPage.tooltipOverviewObjectives') }}
            <span class="mt-1 block border-t border-primary/20 pt-1 text-text/80">
              {{ p.t('statisticsPage.tooltipSidesObjectives') }}
            </span>
          </span>
        </span>
      </div>

      <!-- Principal : premier par équipe + par côté -->
      <div v-if="p.objectivesPanelTab === 'objectives'" class="w-full min-w-0 overflow-x-auto">
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsFirstByWin') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsFirstByLoss') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <tr>
              <td class="py-1.5 pr-2">
                {{ p.t('statisticsPage.overviewTeamsFirstBlood') }}
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ teamFirstPctParts('firstBlood', 'win').current }}
                <span :class="teamFirstPctParts('firstBlood', 'win').deltaClass">
                  {{ teamFirstPctParts('firstBlood', 'win').delta }}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ teamFirstPctParts('firstBlood', 'loss').current }}
                <span :class="teamFirstPctParts('firstBlood', 'loss').deltaClass">
                  {{ teamFirstPctParts('firstBlood', 'loss').delta }}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ sideFirstPctParts('firstBlood', 'blue').current }}
                <span :class="sideFirstPctParts('firstBlood', 'blue').deltaClass">
                  {{ sideFirstPctParts('firstBlood', 'blue').delta }}
                </span>
              </td>
              <td class="py-1.5 pl-1 text-center">
                {{ sideFirstPctParts('firstBlood', 'red').current }}
                <span :class="sideFirstPctParts('firstBlood', 'red').deltaClass">
                  {{ sideFirstPctParts('firstBlood', 'red').delta }}
                </span>
              </td>
            </tr>
            <template v-for="key in p.objectiveKeysWithKills" :key="key">
              <tr>
                <td class="py-1.5 pr-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                    @click="syncToggleObjective(key)"
                  >
                    <span
                      class="inline-block transition-transform duration-200"
                      :class="p.openObjectiveKeys.has(key) ? 'rotate-180' : ''"
                      aria-hidden
                      >▼</span
                    >
                    <img
                      v-if="p.objectiveIconSrc(key)"
                      :src="p.objectiveIconSrc(key)"
                      :alt="p.t('statisticsPage.overviewTeamsObjective_' + key)"
                      class="h-4 w-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      @error="p.onObjectiveIconError($event, key)"
                    />
                    {{ p.t('statisticsPage.overviewTeamsObjective_' + key) }}
                  </button>
                </td>
                <td class="px-1 py-1.5 text-center">
                  {{ teamFirstPctParts(key, 'win').current }}
                  <span :class="teamFirstPctParts(key, 'win').deltaClass">
                    {{ teamFirstPctParts(key, 'win').delta }}
                  </span>
                </td>
                <td class="px-1 py-1.5 text-center">
                  {{ teamFirstPctParts(key, 'loss').current }}
                  <span :class="teamFirstPctParts(key, 'loss').deltaClass">
                    {{ teamFirstPctParts(key, 'loss').delta }}
                  </span>
                </td>
                <td class="px-1 py-1.5 text-center">
                  {{ sideFirstPctParts(key, 'blue').current }}
                  <span :class="sideFirstPctParts(key, 'blue').deltaClass">
                    {{ sideFirstPctParts(key, 'blue').delta }}
                  </span>
                </td>
                <td class="py-1.5 pl-1 text-center">
                  {{ sideFirstPctParts(key, 'red').current }}
                  <span :class="sideFirstPctParts(key, 'red').deltaClass">
                    {{ sideFirstPctParts(key, 'red').delta }}
                  </span>
                </td>
              </tr>
              <template v-if="p.openObjectiveKeys.has(key)">
                <tr
                  v-for="count in p.objectiveCounts(key)"
                  :key="key + '-' + count"
                  class="bg-surface/30"
                >
                  <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                  <td class="px-1 py-1 text-center text-text/80">
                    <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                      {{ p.percentForCount(key, count, true) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                      {{ p.percentForCount(key, count, false) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ p.percentForCountSides(key, count, true) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="py-1 pl-1 text-center text-text/80">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ p.percentForCountSides(key, count, false) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Drakes par type -->
      <div v-else-if="p.objectivesPanelTab === 'drakeTypes'" class="w-full min-w-0 overflow-x-auto">
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByWin') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByLoss') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <template v-for="row in p.drakeTypeRows" :key="'drake-type-' + row.key">
              <tr>
                <td class="py-1.5 pr-2 font-medium text-text/90">
                  <button
                    type="button"
                    class="flex items-center gap-2 hover:text-text"
                    @click="toggleDrakeType(row.key)"
                  >
                    <span
                      class="inline-block transition-transform duration-200"
                      :class="openDrakeTypeKeys.has(row.key) ? 'rotate-180' : ''"
                      aria-hidden
                      >▼</span
                    >
                    <span
                      class="h-2.5 w-2.5 rounded-full"
                      :style="{ backgroundColor: rowColor(row.key) }"
                    />
                    <img
                      v-if="p.drakeIconSrc(row.key)"
                      :src="p.drakeIconSrc(row.key)"
                      :alt="row.label"
                      class="h-4 w-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      @error="p.onDrakeIconError($event, row.key)"
                    />
                    <span>{{ row.label }}</span>
                  </button>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ drakeTypePctParts(row.key, 'win').current }}
                    <span :class="drakeTypePctParts(row.key, 'win').deltaClass">
                      {{ drakeTypePctParts(row.key, 'win').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ drakeTypePctParts(row.key, 'loss').current }}
                    <span :class="drakeTypePctParts(row.key, 'loss').deltaClass">
                      {{ drakeTypePctParts(row.key, 'loss').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ drakeTypePctPartsSides(row.key, 'blue').current }}
                    <span :class="drakeTypePctPartsSides(row.key, 'blue').deltaClass">
                      {{ drakeTypePctPartsSides(row.key, 'blue').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="py-1.5 pl-1 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ drakeTypePctPartsSides(row.key, 'red').current }}
                    <span :class="drakeTypePctPartsSides(row.key, 'red').deltaClass">
                      {{ drakeTypePctPartsSides(row.key, 'red').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
              </tr>
              <template v-if="openDrakeTypeKeys.has(row.key)">
                <tr
                  v-for="count in p.drakeTypeCounts(row.key)"
                  :key="'drake-type-dist-' + row.key + '-' + count"
                  class="bg-surface/30"
                >
                  <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                  <td class="px-1 py-1 text-center text-text/80">
                    {{
                      p.overviewTeamsData && p.overviewTeamsData.matchCount > 0
                        ? p.drakeTypePercentForCount(row.key, count, true)
                        : '—'
                    }}
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    {{
                      p.overviewTeamsData && p.overviewTeamsData.matchCount > 0
                        ? p.drakeTypePercentForCount(row.key, count, false)
                        : '—'
                    }}
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    {{
                      p.overviewSidesData && p.overviewSidesData.matchCount > 0
                        ? p.drakeTypePercentForCountSides(row.key, count, true)
                        : '—'
                    }}
                  </td>
                  <td class="py-1 pl-1 text-center text-text/80">
                    {{
                      p.overviewSidesData && p.overviewSidesData.matchCount > 0
                        ? p.drakeTypePercentForCountSides(row.key, count, false)
                        : '—'
                    }}
                  </td>
                </tr>
                <tr v-if="p.drakeTypeCounts(row.key).length === 0" class="bg-surface/30">
                  <td class="py-1 pl-6 pr-2 text-text/70">—</td>
                  <td class="px-1 py-1 text-center text-text/80">—</td>
                  <td class="px-1 py-1 text-center text-text/80">—</td>
                  <td class="px-1 py-1 text-center text-text/80">—</td>
                  <td class="py-1 pl-1 text-center text-text/80">—</td>
                </tr>
              </template>
            </template>
            <tr v-if="p.drakeTypeRows.length === 0">
              <td colspan="5" class="py-2 text-center text-text/60">
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Âmes -->
      <div v-else class="w-full min-w-0 overflow-x-auto">
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByWin') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByLoss') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <tr>
              <td class="py-1.5 pr-2 font-medium text-text/90">
                {{ p.t('statisticsPage.objectivesSoulGlobal') }}
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                  {{ p.teamPercent(p.drakeSoulGlobal.byWin, p.overviewTeamsData.matchCount) }}
                </template>
                <template v-else>—</template>
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                  {{ p.teamPercent(p.drakeSoulGlobal.byLoss, p.overviewTeamsData.matchCount) }}
                </template>
                <template v-else>—</template>
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ p.teamPercent(p.sidesDrakeSoulGlobal.byBlue, p.overviewSidesData.matchCount) }}
                </template>
                <template v-else>—</template>
              </td>
              <td class="py-1.5 pl-1 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ p.teamPercent(p.sidesDrakeSoulGlobal.byRed, p.overviewSidesData.matchCount) }}
                </template>
                <template v-else>—</template>
              </td>
            </tr>
            <template v-for="row in p.drakeSoulRows" :key="'drake-soul-' + row.key">
              <tr>
                <td class="py-1.5 pr-2 font-medium text-text/90">
                  <div class="flex items-center gap-2">
                    <span
                      class="h-2.5 w-2.5 rounded-full"
                      :style="{ backgroundColor: rowColor(row.key) }"
                    />
                    <img
                      v-if="p.drakeIconSrc(row.key)"
                      :src="p.drakeIconSrc(row.key)"
                      :alt="row.label"
                      class="h-4 w-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      @error="p.onDrakeIconError($event, row.key)"
                    />
                    <span>{{ row.label }}</span>
                  </div>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ p.teamPercent(row.byWin, p.overviewTeamsData.matchCount) }}
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ p.teamPercent(row.byLoss, p.overviewTeamsData.matchCount) }}
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{
                      p.teamPercent(
                        sidesDrakeSoulByKey(row.key).byBlue,
                        p.overviewSidesData.matchCount
                      )
                    }}
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="py-1.5 pl-1 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{
                      p.teamPercent(
                        sidesDrakeSoulByKey(row.key).byRed,
                        p.overviewSidesData.matchCount
                      )
                    }}
                  </template>
                  <template v-else>—</template>
                </td>
              </tr>
            </template>
            <tr v-if="p.drakeSoulRows.length === 0">
              <td colspan="5" class="py-2 text-center text-text/60">
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="drakeDistRows.length > 0 || soulDistRows.length > 0"
      class="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <div
        class="fast-stat-card mx-auto w-full max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <h4 class="mb-2 text-sm font-semibold text-text/90">
          {{ p.t('statisticsPage.objectivesDrakeDistributionCardTitle') }}
        </h4>
        <div v-if="drakeDistRows.length > 0" class="flex flex-col items-center gap-3">
          <div class="relative inline-flex h-[132px] w-[132px] items-center justify-center">
            <svg viewBox="0 0 120 120" class="absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                :stroke-width="DONUT_STROKE"
              />
              <circle
                v-for="(row, idx) in drakeDistRows"
                :key="'drake-donut-' + row.key"
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                :stroke="drakeDonutSegments[idx]?.color"
                :stroke-width="DONUT_STROKE"
                :stroke-dasharray="`${drakeDonutSegments[idx]?.arc ?? 0} ${DONUT_CIRCLE - (drakeDonutSegments[idx]?.arc ?? 0)}`"
                :stroke-dashoffset="`-${drakeDonutSegments[idx]?.offset ?? 0}`"
              >
                <title v-if="tooltipsEnabled">{{ donutTooltip(row, drakeDistTotal) }}</title>
              </circle>
            </svg>
            <span class="relative z-10 text-lg font-bold text-blue-600 dark:text-blue-300"
              >100%</span
            >
          </div>
          <ul class="grid w-full max-w-[340px] grid-cols-1 gap-1 text-xs text-text/85">
            <li
              v-for="row in drakeDistRows"
              :key="'drake-dist-legend-' + row.key"
              class="flex items-center justify-between gap-2"
            >
              <span class="inline-flex min-w-0 items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: row.color }"
                />
                <span class="truncate">{{ row.label }}</span>
              </span>
              <span class="shrink-0 font-semibold">{{ distPct(row.value, drakeDistTotal) }}</span>
            </li>
          </ul>
        </div>
        <div v-else class="text-sm text-text/60">{{ p.t('statisticsPage.noData') }}</div>
      </div>

      <div
        class="fast-stat-card mx-auto w-full max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <h4 class="mb-2 text-sm font-semibold text-text/90">
          {{ p.t('statisticsPage.objectivesSoulDistributionCardTitle') }}
        </h4>
        <div v-if="soulDistRows.length > 0" class="flex flex-col items-center gap-3">
          <div class="relative inline-flex h-[132px] w-[132px] items-center justify-center">
            <svg viewBox="0 0 120 120" class="absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                :stroke-width="DONUT_STROKE"
              />
              <circle
                v-for="(row, idx) in soulDistRows"
                :key="'soul-donut-' + row.key"
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                :stroke="soulDonutSegments[idx]?.color"
                :stroke-width="DONUT_STROKE"
                :stroke-dasharray="`${soulDonutSegments[idx]?.arc ?? 0} ${DONUT_CIRCLE - (soulDonutSegments[idx]?.arc ?? 0)}`"
                :stroke-dashoffset="`-${soulDonutSegments[idx]?.offset ?? 0}`"
              >
                <title v-if="tooltipsEnabled">{{ donutTooltip(row, soulDistTotal) }}</title>
              </circle>
            </svg>
            <span class="relative z-10 text-lg font-bold text-blue-600 dark:text-blue-300"
              >100%</span
            >
          </div>
          <ul class="grid w-full max-w-[340px] grid-cols-1 gap-1 text-xs text-text/85">
            <li
              v-for="row in soulDistRows"
              :key="'soul-dist-legend-' + row.key"
              class="flex items-center justify-between gap-2"
            >
              <span class="inline-flex min-w-0 items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: row.color }"
                />
                <span class="truncate">{{ row.label }}</span>
              </span>
              <span class="shrink-0 font-semibold">{{ distPct(row.value, soulDistTotal) }}</span>
            </li>
          </ul>
        </div>
        <div v-else class="text-sm text-text/60">{{ p.t('statisticsPage.noData') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.objectives-zebra-cols th:nth-child(even),
.objectives-zebra-cols td:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.04);
}
</style>
