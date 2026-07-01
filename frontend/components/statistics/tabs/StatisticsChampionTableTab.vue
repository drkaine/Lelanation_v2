<script setup lang="ts">
import { inject, ref, unref, computed, watch } from 'vue'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import {
  championTransformLabelKey,
  getChampionTransformPortraitSrc,
  normalizeChampionTransform,
  resolveTransformFromSearchQuery,
  type ChampionTransform,
} from '~/utils/championTransformStats'

const p = inject('statisticsPageCtx') as any
const showChampionDealtBreakdown = ref(false)
const showChampionTakenBreakdown = ref(false)
const showChampionHealBreakdown = ref(false)
const expandedChampionRowKeys = ref<Set<string>>(new Set())
const transformViewByChampionId = ref<Map<number, 'all' | ChampionTransform>>(new Map())

type ChampionGlobalRow = {
  championId: number
  championTransform?: ChampionTransform
  blue: { games: number; wins: number; winrate: number; pickrate: number; banrate: number }
  red: { games: number; wins: number; winrate: number; pickrate: number; banrate: number }
  totalGames: number
  avgDamageToChamps: number
  avgDamageToChampsPhys: number
  avgDamageToChampsMagic: number
  avgDamageToChampsTrue: number
  avgDamageTakenPhys: number
  avgDamageTakenMagic: number
  avgDamageTakenTrue: number
  avgDamageTakenTotal: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  avgTotalHeal: number
  avgHealsOnTeammates: number
  avgEffectiveHealShield: number
  avgDamageShieldedOnTeammates: number
  avgDamageSelfMitigated: number
  avgTimeCcDealt: number
}

type TableDisplayEntry = {
  key: string
  row: ChampionGlobalRow
  sub: boolean
  championId: number
  showTransformDropdown: boolean
}

function getTransformView(championId: number): 'all' | ChampionTransform {
  return transformViewByChampionId.value.get(championId) ?? 'all'
}

function setTransformView(championId: number, value: 'all' | ChampionTransform): void {
  const next = new Map(transformViewByChampionId.value)
  if (value === 'all') next.delete(championId)
  else next.set(championId, value)
  transformViewByChampionId.value = next
}

function transformRowsForChampion(championId: number): ChampionGlobalRow[] {
  return p.championGlobalTransformRows(championId) as ChampionGlobalRow[]
}

function rowPortraitSrc(row: ChampionGlobalRow): string | null {
  const defaultSrc =
    p.gameVersion && p.championByKey(row.championId)
      ? p.getChampionImageUrl(p.gameVersion, p.championByKey(row.championId)!.image.full)
      : null
  return getChampionTransformPortraitSrc(
    row.championId,
    normalizeChampionTransform(row.championTransform),
    defaultSrc
  )
}

function rowNumericDelta(
  row: ChampionGlobalRow,
  key:
    | 'avgDamageToChamps'
    | 'avgDamageToChampsPhys'
    | 'avgDamageToChampsMagic'
    | 'avgDamageToChampsTrue'
    | 'avgDamageTakenTotal'
    | 'avgDamageTakenPhys'
    | 'avgDamageTakenMagic'
    | 'avgDamageTakenTrue'
    | 'avgKills'
    | 'avgDeaths'
    | 'avgAssists'
    | 'avgTotalHeal'
    | 'avgHealsOnTeammates'
    | 'avgEffectiveHealShield'
    | 'avgDamageShieldedOnTeammates'
    | 'avgDamageSelfMitigated'
    | 'avgTimeCcDealt'
): number | undefined {
  return p.championGlobalNumericDelta(row.championId, key, row.championTransform)
}

watch(
  () => String(p.championSearchQuery ?? '').trim(),
  query => {
    if (!query || p.statsSplitTransformEnabled) return
    const qualified = resolveTransformFromSearchQuery(141, query)
    if (qualified == null || !p.championHasTransformBreakdown(141)) return
    setTransformView(141, qualified)
  }
)

watch(
  () => Boolean(p.statsSplitTransformEnabled),
  enabled => {
    if (enabled) transformViewByChampionId.value = new Map()
  }
)

const championTableDisplayEntries = computed<TableDisplayEntry[]>(() => {
  const entries: TableDisplayEntry[] = []
  for (const row of p.paginatedChampionGlobalRows as ChampionGlobalRow[]) {
    const showTransformDropdown =
      !p.statsSplitTransformEnabled && p.championHasTransformBreakdown(row.championId)
    entries.push({
      key: p.championGlobalRowKey(row),
      row,
      sub: false,
      championId: row.championId,
      showTransformDropdown,
    })
    const transformView = getTransformView(row.championId)
    if (!p.statsSplitTransformEnabled && transformView !== 'all') {
      for (const subRow of transformRowsForChampion(row.championId)) {
        if (normalizeChampionTransform(subRow.championTransform) !== transformView) continue
        entries.push({
          key: `${p.championGlobalRowKey(subRow)}-sub`,
          row: subRow,
          sub: true,
          championId: row.championId,
          showTransformDropdown: false,
        })
      }
    }
  }
  return entries
})

function onChampionPageSizeChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const fallback = unref(p.championsPageSize)
  p.onChampionGlobalPageSizeUpdated(Number(target?.value ?? fallback))
}

function championCardRowKey(row: ChampionGlobalRow): string {
  return String(p.championGlobalRowKey(row))
}

function isChampionCardExpanded(row: ChampionGlobalRow): boolean {
  return expandedChampionRowKeys.value.has(championCardRowKey(row))
}

function toggleChampionCardExpanded(row: ChampionGlobalRow): void {
  const key = championCardRowKey(row)
  const next = new Set(expandedChampionRowKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedChampionRowKeys.value = next
}

const activeRoleLabel = computed(() => {
  const role = p.statsRoleFilter as string
  if (!role) return p.t('statisticsPage.allRoles')
  const roles = (p.roles as Array<{ value: string; label: string }>) ?? []
  return roles.find(r => r.value === role)?.label ?? role
})

const activeRoleIconSrc = computed(() => {
  const role = p.statsRoleFilter as string
  if (!role) return '/icons/roles/all-role.png'
  return p.mainRoleIconSrc(role) ?? '/icons/roles/all-role.png'
})

const STAT_COL_MIN_PX = 52
const CHAMPION_COL_MIN_PX = 220
const KDA_COL_MIN_PX = 160

/** Colonnes stats (hors champion / KDA) actuellement affichées. */
const visibleStatColumnCount = computed(() => {
  let n = 0
  if (p.showChampionHealColumns) {
    n += 3
    if (showChampionHealBreakdown.value) n += 3
  }
  if (p.showChampionDealtColumns) {
    n += 1
    if (showChampionDealtBreakdown.value) n += 3
  }
  if (p.showChampionTakenColumns) {
    n += 1
    if (showChampionTakenBreakdown.value) n += 3
  }
  return n
})

const championTableMinWidthPx = computed(() => {
  const statCols = visibleStatColumnCount.value
  return CHAMPION_COL_MIN_PX + statCols * STAT_COL_MIN_PX + KDA_COL_MIN_PX
})

/** Variables CSS : les colonnes stats se partagent l’espace horizontal restant. */
const championTableLayoutStyle = computed(() => {
  const statCols = visibleStatColumnCount.value
  const statMinPx = statCols >= 12 ? 60 : statCols >= 9 ? 56 : statCols >= 6 ? 54 : STAT_COL_MIN_PX
  return {
    width: '100%',
    minWidth: `${championTableMinWidthPx.value}px`,
    '--cg-stat-min': `${statMinPx}px`,
    '--cg-champion-min': `${CHAMPION_COL_MIN_PX}px`,
    '--cg-kda-min': `${KDA_COL_MIN_PX}px`,
  } as Record<string, string>
})

const championMobileSortColumn = computed({
  get: () => String(p.championGlobalSortColumn ?? 'totalGames'),
  set: (v: string) => {
    p.championGlobalSortColumn = v
  },
})

const championMobileSortDir = computed({
  get: () => (p.championGlobalSortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
  set: (v: 'asc' | 'desc') => {
    p.championGlobalSortDir = v
  },
})

const championMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => {
  const t = p.t
  const opts: StatisticsMobileSortOption[] = [
    { value: 'champion', label: t('statisticsPage.champion') },
    { value: 'totalGames', label: t('statisticsPage.games') },
    { value: 'healTotal', label: t('statisticsPage.championTableColTotalHeal') },
    { value: 'mitigated', label: t('statisticsPage.championTableColMitigation') },
    { value: 'ccTime', label: t('statisticsPage.championTableColCcTime') },
    { value: 'dmgTotal', label: t('statisticsPage.championTableColTotalInflicted') },
    { value: 'takenTotal', label: t('statisticsPage.championTableColTotalTaken') },
    { value: 'kills', label: t('statisticsPage.championTableColKill') },
    { value: 'deaths', label: t('statisticsPage.championTableColDeath') },
    { value: 'assists', label: t('statisticsPage.championTableColAssist') },
  ]
  if (p.championGlobalPatchDeltaRefLabel) {
    opts.splice(
      2,
      0,
      { value: 'healTotalDelta', label: `Δ ${t('statisticsPage.championTableColTotalHeal')}` },
      { value: 'mitigatedDelta', label: `Δ ${t('statisticsPage.championTableColMitigation')}` },
      { value: 'ccTimeDelta', label: `Δ ${t('statisticsPage.championTableColCcTime')}` },
      { value: 'dmgTotalDelta', label: `Δ ${t('statisticsPage.championTableColTotalInflicted')}` },
      { value: 'takenTotalDelta', label: `Δ ${t('statisticsPage.championTableColTotalTaken')}` },
      { value: 'killsDelta', label: `Δ ${t('statisticsPage.championTableColKill')}` },
      { value: 'deathsDelta', label: `Δ ${t('statisticsPage.championTableColDeath')}` },
      { value: 'assistsDelta', label: `Δ ${t('statisticsPage.championTableColAssist')}` }
    )
  }
  return opts
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="p.championGlobalTablePending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div
      v-else-if="p.championGlobalTableError"
      class="rounded border border-error bg-surface p-3 text-error"
    >
      {{ p.championGlobalTableError }}
    </div>
    <div
      v-else-if="p.championGlobalSortedRows.length === 0"
      class="statistics-overview-surface rounded-lg border border-primary/30 p-4 text-text/70"
    >
      {{ p.t('statisticsPage.championTableNoData') }}
    </div>
    <template v-else>
      <StatisticsMobileSortBar
        id="champion-global-mobile-sort"
        v-model:column="championMobileSortColumn"
        v-model:direction="championMobileSortDir"
        :options="championMobileSortOptions"
        :asc-default-columns="['champion']"
        :help-aria-label="p.t('statisticsPage.tooltipTableChampionAria')"
        :help-text="p.t('statisticsPage.tooltipTableChampion')"
        :help-secondary-text="p.t('statisticsPage.championTableDeltaColumnsHint')"
      />
      <!-- Mobile : cards -->
      <div class="statistics-champion-mobile-list space-y-2 md:hidden">
        <article
          v-for="row in p.paginatedChampionGlobalRows"
          :key="'mobile-' + p.championGlobalRowKey(row)"
          class="statistics-champion-stats-mobile-card statistics-champion-mobile-card w-full cursor-pointer overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
          role="button"
          tabindex="0"
          :aria-expanded="isChampionCardExpanded(row)"
          @click="toggleChampionCardExpanded(row)"
          @keydown.enter.prevent="toggleChampionCardExpanded(row)"
          @keydown.space.prevent="toggleChampionCardExpanded(row)"
        >
          <div
            class="statistics-champion-stats-mobile-card-header flex w-full items-center gap-3 p-3"
          >
            <div class="shrink-0" @click.stop>
              <StatisticsChampionStatsMobileCardHeader
                :champion-id="row.championId"
                :champion-name="
                  p.statsSplitTransformEnabled && row.championTransform != null
                    ? `${p.championName(row.championId) || row.championId} · ${p.t(championTransformLabelKey(normalizeChampionTransform(row.championTransform)))}`
                    : String(p.championName(row.championId) || row.championId)
                "
                :search-query="p.championSearchQuery"
                :role-label="activeRoleLabel"
                :role-icon-src="activeRoleIconSrc"
                :portrait-src="rowPortraitSrc(row)"
                :portrait-alt="p.championName(row.championId) || ''"
              />
            </div>
            <div class="flex min-w-0 flex-1 flex-col items-end justify-center text-right">
              <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                {{ p.t('statisticsPage.championTableGroupKda') }}
              </div>
              <div
                class="font-mono text-xl font-bold tabular-nums leading-tight text-text sm:text-2xl"
              >
                K {{ p.formatChampionGlobalNum(row.avgKills) }} / D
                {{ p.formatChampionGlobalNum(row.avgDeaths) }} / A
                {{ p.formatChampionGlobalNum(row.avgAssists) }}
              </div>
              <div
                v-if="
                  p.championGlobalPatchDeltaRefLabel &&
                  (rowNumericDelta(row, 'avgKills') != null ||
                    rowNumericDelta(row, 'avgDeaths') != null ||
                    rowNumericDelta(row, 'avgAssists') != null)
                "
                class="mt-0.5 text-xs tabular-nums leading-none text-text/75"
              >
                <template v-if="rowNumericDelta(row, 'avgKills') != null">
                  <span
                    :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgKills')!)"
                    >K
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgKills')!)
                    }}</span
                  >
                </template>
                <template
                  v-if="
                    rowNumericDelta(row, 'avgKills') != null &&
                    rowNumericDelta(row, 'avgDeaths') != null
                  "
                >
                  <span class="px-1 text-text/45">|</span>
                </template>
                <template v-if="rowNumericDelta(row, 'avgDeaths') != null">
                  <span
                    :class="
                      p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDeaths')!, true)
                    "
                    >D
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDeaths')!)
                    }}</span
                  >
                </template>
                <template
                  v-if="
                    (rowNumericDelta(row, 'avgKills') != null ||
                      rowNumericDelta(row, 'avgDeaths') != null) &&
                    rowNumericDelta(row, 'avgAssists') != null
                  "
                >
                  <span class="px-1 text-text/45">|</span>
                </template>
                <template v-if="rowNumericDelta(row, 'avgAssists') != null">
                  <span
                    :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgAssists')!)"
                    >A
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgAssists')!)
                    }}</span
                  >
                </template>
              </div>
            </div>
          </div>
          <div
            v-if="isChampionCardExpanded(row)"
            class="space-y-2 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-xs text-text/85"
            @click.stop
          >
            <div v-if="p.showChampionHealColumns" class="space-y-1.5">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-info/90">
                {{ p.t('statisticsPage.championTableGroupHeal') }}
              </div>
              <div class="grid grid-cols-2 gap-2 tabular-nums">
                <div>
                  {{ p.t('statisticsPage.championTableColTotalHeal') }}:
                  {{ p.formatChampionGlobalNum(row.avgTotalHeal) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgTotalHeal') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgTotalHeal')!)
                    "
                  >
                    {{ p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgTotalHeal')!) }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColHealAllies') }}:
                  {{ p.formatChampionGlobalNum(row.avgHealsOnTeammates) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgHealsOnTeammates') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgHealsOnTeammates')!
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgHealsOnTeammates')!
                      )
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColEffectiveHealShield') }}:
                  {{ p.formatChampionGlobalNum(row.avgEffectiveHealShield) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgEffectiveHealShield') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgEffectiveHealShield')!
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgEffectiveHealShield')!
                      )
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColShieldAllies') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageShieldedOnTeammates) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageShieldedOnTeammates') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageShieldedOnTeammates')!
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageShieldedOnTeammates')!
                      )
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColMitigation') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageSelfMitigated) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageSelfMitigated') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageSelfMitigated')!
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageSelfMitigated')!
                      )
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColCcTime') }}:
                  {{ p.formatChampionGlobalNum(row.avgTimeCcDealt) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgTimeCcDealt') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgTimeCcDealt')!)
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgTimeCcDealt')!)
                    }}
                  </span>
                </div>
              </div>
            </div>
            <div v-if="p.showChampionDealtColumns" class="space-y-1.5">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-text-accent/90">
                {{ p.t('statisticsPage.championTableGroupDealt') }}
              </div>
              <div class="grid grid-cols-2 gap-2 tabular-nums">
                <div class="col-span-2">
                  {{ p.t('statisticsPage.championTableColTotalInflicted') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageToChamps) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageToChamps') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDamageToChamps')!)
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageToChamps')!)
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColPhys') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageToChampsPhys) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageToChampsPhys') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageToChampsPhys')!
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageToChampsPhys')!
                      )
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColMagic') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageToChampsMagic) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageToChampsMagic') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageToChampsMagic')!
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageToChampsMagic')!
                      )
                    }}
                  </span>
                </div>
                <div class="col-span-2">
                  {{ p.t('statisticsPage.championTableColBrut') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageToChampsTrue) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageToChampsTrue') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageToChampsTrue')!
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageToChampsTrue')!
                      )
                    }}
                  </span>
                </div>
              </div>
            </div>
            <div v-if="p.showChampionTakenColumns" class="space-y-1.5">
              <div class="text-error/70/90 text-[10px] font-semibold uppercase tracking-wide">
                {{ p.t('statisticsPage.championTableGroupTaken') }}
              </div>
              <div class="grid grid-cols-2 gap-2 tabular-nums">
                <div class="col-span-2">
                  {{ p.t('statisticsPage.championTableColTotalTaken') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageTakenTotal) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageTakenTotal') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageTakenTotal')!,
                        true
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageTakenTotal')!
                      )
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColPhys') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageTakenPhys) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageTakenPhys') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageTakenPhys')!,
                        true
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageTakenPhys')!
                      )
                    }}
                  </span>
                </div>
                <div>
                  {{ p.t('statisticsPage.championTableColMagic') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageTakenMagic) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageTakenMagic') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageTakenMagic')!,
                        true
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageTakenMagic')!
                      )
                    }}
                  </span>
                </div>
                <div class="col-span-2">
                  {{ p.t('statisticsPage.championTableColBrut') }}:
                  {{ p.formatChampionGlobalNum(row.avgDamageTakenTrue) }}
                  <span
                    v-if="rowNumericDelta(row, 'avgDamageTakenTrue') != null"
                    class="ml-1"
                    :class="
                      p.championGlobalNumericDeltaClass(
                        rowNumericDelta(row, 'avgDamageTakenTrue')!,
                        true
                      )
                    "
                  >
                    {{
                      p.formatChampionGlobalNumericDelta(
                        rowNumericDelta(row, 'avgDamageTakenTrue')!
                      )
                    }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            v-if="!p.statsSplitTransformEnabled && p.championHasTransformBreakdown(row.championId)"
            class="border-t border-primary/20 bg-black/10 px-3 py-2"
            @click.stop
          >
            <StatisticsChampionTransformSelect
              :champion-id="row.championId"
              :transform-rows="transformRowsForChampion(row.championId)"
              :model-value="getTransformView(row.championId)"
              @update:model-value="setTransformView(row.championId, $event)"
            />
          </div>
          <div
            v-if="!p.statsSplitTransformEnabled && getTransformView(row.championId) !== 'all'"
            class="space-y-2 border-t border-primary/20 bg-black/15 px-3 py-2"
            @click.stop
          >
            <article
              v-for="subRow in transformRowsForChampion(row.championId).filter(
                sr =>
                  normalizeChampionTransform(sr.championTransform) ===
                  getTransformView(row.championId)
              )"
              :key="'mobile-sub-' + p.championGlobalRowKey(subRow)"
              class="rounded border border-primary/20 bg-black/20 p-2 text-sm"
            >
              <div class="mb-2 flex items-center gap-2">
                <img
                  v-if="rowPortraitSrc(subRow)"
                  :src="rowPortraitSrc(subRow)!"
                  alt=""
                  class="h-8 w-8 border border-black object-cover"
                  width="32"
                  height="32"
                />
                <span class="text-xs font-semibold text-text/90">
                  {{
                    p.t(
                      championTransformLabelKey(
                        normalizeChampionTransform(subRow.championTransform)
                      )
                    )
                  }}
                </span>
              </div>
              <div class="font-mono text-xs tabular-nums text-text/85">
                K {{ p.formatChampionGlobalNum(subRow.avgKills) }} / D
                {{ p.formatChampionGlobalNum(subRow.avgDeaths) }} / A
                {{ p.formatChampionGlobalNum(subRow.avgAssists) }}
              </div>
            </article>
          </div>
        </article>
        <div
          v-if="p.totalChampionGlobalCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 px-3 py-2 text-sm text-text/80"
        >
          <span>{{ p.t('statisticsPage.showing') }} {{ p.totalChampionGlobalCount }}</span>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded border border-primary/40 bg-surface/50 px-2 py-1 disabled:opacity-50"
              :disabled="p.championGlobalPage <= 1"
              @click="p.onChampionGlobalPageUpdated(Math.max(1, p.championGlobalPage - 1))"
            >
              ‹
            </button>
            <span class="text-xs tabular-nums">
              {{ (p.championGlobalPage - 1) * p.championsPageSize + 1 }}-{{
                Math.min(p.championGlobalPage * p.championsPageSize, p.totalChampionGlobalCount)
              }}
            </span>
            <button
              type="button"
              class="rounded border border-primary/40 bg-surface/50 px-2 py-1 disabled:opacity-50"
              :disabled="p.championGlobalPage >= p.totalChampionGlobalPages"
              @click="
                p.onChampionGlobalPageUpdated(
                  Math.min(p.totalChampionGlobalPages, p.championGlobalPage + 1)
                )
              "
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <!-- Desktop : tableau -->
      <div
        class="tier-list-mobile-rotate statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
      >
        <div
          class="tier-list-lolalytics champion-global-table w-full min-w-0 text-[13px] text-text-primary/90"
          :style="championTableLayoutStyle"
        >
          <div
            class="tier-list-lolalytics-head sticky top-0 z-10 flex h-auto min-h-8 w-full items-stretch justify-start border-b border-black bg-[var(--color-grey-300)] text-text-primary/85"
          >
            <div
              class="champion-global-champ-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex items-center justify-start border-b border-black px-2 max-lg:w-[56px] max-lg:flex-none max-lg:shrink-0 max-lg:justify-center max-lg:px-0.5"
              :title="p.t('statisticsPage.championTableTooltipChampion')"
            >
              <span class="max-lg:hidden">{{ p.t('statisticsPage.tierListColChampion') }}</span>
            </div>
            <!-- Soins & combat -->
            <div
              v-show="p.showChampionHealColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableColTotalHeal')"
                @click="p.setChampionGlobalSort('healTotal')"
              >
                {{ p.t('statisticsPage.championTableColTotalHeal')
                }}{{ p.championGlobalSortIcon('healTotal') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('healTotalDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('healTotalDelta') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
                :title="showChampionHealBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
                @click="showChampionHealBreakdown = !showChampionHealBreakdown"
              >
                {{ showChampionHealBreakdown ? '▴' : '▾' }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns && showChampionHealBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                @click="p.setChampionGlobalSort('healTeam')"
              >
                {{ p.t('statisticsPage.championTableColHealAllies')
                }}{{ p.championGlobalSortIcon('healTeam') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('healTeamDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('healTeamDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns && showChampionHealBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                @click="p.setChampionGlobalSort('healEffective')"
              >
                {{ p.t('statisticsPage.championTableColEffectiveHealShield')
                }}{{ p.championGlobalSortIcon('healEffective') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('healEffectiveDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('healEffectiveDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns && showChampionHealBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                @click="p.setChampionGlobalSort('shieldTeam')"
              >
                {{ p.t('statisticsPage.championTableColShieldAllies')
                }}{{ p.championGlobalSortIcon('shieldTeam') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('shieldTeamDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('shieldTeamDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-info hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableColMitigation')"
                @click="p.setChampionGlobalSort('mitigated')"
              >
                {{ p.t('statisticsPage.championTableColMitigation')
                }}{{ p.championGlobalSortIcon('mitigated') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('mitigatedDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('mitigatedDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionHealColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-200 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableColCcTime')"
                @click="p.setChampionGlobalSort('ccTime')"
              >
                {{ p.t('statisticsPage.championTableColCcTime')
                }}{{ p.championGlobalSortIcon('ccTime') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('ccTimeDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('ccTimeDelta') }}
              </button>
            </div>
            <!-- Dégâts infligés -->
            <div
              v-show="p.showChampionDealtColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTooltipDealt')"
                @click="p.setChampionGlobalSort('dmgTotal')"
              >
                {{ p.t('statisticsPage.championTableColTotalInflicted')
                }}{{ p.championGlobalSortIcon('dmgTotal') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgTotalDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgTotalDelta') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
                :title="showChampionDealtBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
                @click="showChampionDealtBreakdown = !showChampionDealtBreakdown"
              >
                {{ showChampionDealtBreakdown ? '▴' : '▾' }}
              </button>
            </div>
            <div
              v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-text-accent hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableDealtPhys')"
                @click="p.setChampionGlobalSort('dmgPhys')"
              >
                {{ p.t('statisticsPage.championTableColPhys')
                }}{{ p.championGlobalSortIcon('dmgPhys') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgPhysDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgPhysDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-300 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableDealtMagic')"
                @click="p.setChampionGlobalSort('dmgMagic')"
              >
                {{ p.t('statisticsPage.championTableColMagic')
                }}{{ p.championGlobalSortIcon('dmgMagic') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgMagicDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgMagicDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-slate-200 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableDealtTrue')"
                @click="p.setChampionGlobalSort('dmgTrue')"
              >
                {{ p.t('statisticsPage.championTableColBrut')
                }}{{ p.championGlobalSortIcon('dmgTrue') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('dmgTrueDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('dmgTrueDelta') }}
              </button>
            </div>
            <!-- Dégâts subis -->
            <div
              v-show="p.showChampionTakenColumns"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTooltipTaken')"
                @click="p.setChampionGlobalSort('takenTotal')"
              >
                {{ p.t('statisticsPage.championTableColTotalTaken')
                }}{{ p.championGlobalSortIcon('takenTotal') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenTotalDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenTotalDelta') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[10px] leading-tight text-text/80 hover:bg-primary/20"
                :title="showChampionTakenBreakdown ? 'Masquer le détail' : 'Afficher le détail'"
                @click="showChampionTakenBreakdown = !showChampionTakenBreakdown"
              >
                {{ showChampionTakenBreakdown ? '▴' : '▾' }}
              </button>
            </div>
            <div
              v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-text-accent hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTakenPhys')"
                @click="p.setChampionGlobalSort('takenPhys')"
              >
                {{ p.t('statisticsPage.championTableColPhys')
                }}{{ p.championGlobalSortIcon('takenPhys') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenPhysDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenPhysDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-violet-300 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTakenMagic')"
                @click="p.setChampionGlobalSort('takenMagic')"
              >
                {{ p.t('statisticsPage.championTableColMagic')
                }}{{ p.championGlobalSortIcon('takenMagic') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenMagicDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenMagicDelta') }}
              </button>
            </div>
            <div
              v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
              class="champion-global-stat-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-row items-center justify-center gap-0.5 border-b border-black px-0.5 py-1"
            >
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center px-0.5 text-center text-[10px] leading-tight text-slate-200 hover:bg-primary/25"
                :title="p.t('statisticsPage.championTableTakenTrue')"
                @click="p.setChampionGlobalSort('takenTrue')"
              >
                {{ p.t('statisticsPage.championTableColBrut')
                }}{{ p.championGlobalSortIcon('takenTrue') }}
              </button>
              <button
                type="button"
                class="inline-flex shrink-0 items-center justify-center border-l border-black/25 pl-0.5 text-center text-[9px] leading-tight text-text/80 hover:bg-primary/20"
                :title="p.t('statisticsPage.tierListPatchDeltaSortTooltip')"
                @click="p.setChampionGlobalSort('takenTrueDelta')"
              >
                {{ p.t('statisticsPage.championTableDeltaSymbol')
                }}{{ p.championGlobalSortIcon('takenTrueDelta') }}
              </button>
            </div>
            <!-- KDA compact -->
            <div
              class="champion-global-kda-col tier-list-lolalytics-th tier-list-lolalytics-th-all border-p.t border-p.t-[var(--color-grey-300)] flex min-h-8 flex-col items-stretch justify-center border-b border-black px-1 py-1"
            >
              <div class="text-center text-[10px] font-semibold leading-tight text-text/90">
                K / D / A
              </div>
              <div class="mt-0.5 flex items-center justify-center gap-1 text-[9px] leading-tight">
                <button
                  type="button"
                  class="rounded px-1 hover:bg-primary/20"
                  :title="p.t('statisticsPage.championTableColKill')"
                  @click="p.setChampionGlobalSort('kills')"
                >
                  K{{ p.championGlobalSortIcon('kills') }}
                </button>
                <button
                  type="button"
                  class="rounded px-1 hover:bg-primary/20"
                  :title="p.t('statisticsPage.championTableColDeath')"
                  @click="p.setChampionGlobalSort('deaths')"
                >
                  D{{ p.championGlobalSortIcon('deaths') }}
                </button>
                <button
                  type="button"
                  class="rounded px-1 hover:bg-primary/20"
                  :title="p.t('statisticsPage.championTableColAssist')"
                  @click="p.setChampionGlobalSort('assists')"
                >
                  A{{ p.championGlobalSortIcon('assists') }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-for="entry in championTableDisplayEntries"
            :key="entry.key"
            class="tier-list-lolalytics-row flex min-h-[60px] w-full flex-nowrap items-center justify-start py-0.5 text-text-primary/90 odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
            :class="entry.sub ? 'bg-black/35' : ''"
          >
            <StatisticsTierListChampionCell
              :champion-id="entry.row.championId"
              :highlight-query="p.championSearchQuery"
              width-class="champion-global-champ-col max-lg:w-[56px]"
              allow-grow
              :portrait-src-override="rowPortraitSrc(entry.row)"
              :champion-transform="
                p.statsSplitTransformEnabled || entry.sub
                  ? normalizeChampionTransform(entry.row.championTransform)
                  : undefined
              "
              :show-transform-dropdown="entry.showTransformDropdown"
              :transform-rows="transformRowsForChampion(entry.championId)"
              :transform-view="getTransformView(entry.championId)"
              :is-transform-sub-row="entry.sub"
              @update:transform-view="setTransformView(entry.championId, $event)"
            />
            <template v-for="row in [entry.row]" :key="p.championGlobalRowKey(row) + '-stats'">
              <div
                v-show="p.showChampionHealColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-info">{{
                  p.formatChampionGlobalNum(row.avgTotalHeal)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgTotalHeal') != null
                  "
                  class="text-[10px] leading-none"
                  :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgTotalHeal')!)"
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgTotalHeal')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns && showChampionHealBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-info">{{
                  p.formatChampionGlobalNum(row.avgHealsOnTeammates)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgHealsOnTeammates') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgHealsOnTeammates')!)
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgHealsOnTeammates')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns && showChampionHealBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-info">{{
                  p.formatChampionGlobalNum(row.avgEffectiveHealShield)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgEffectiveHealShield') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgEffectiveHealShield')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgEffectiveHealShield')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns && showChampionHealBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-info">{{
                  p.formatChampionGlobalNum(row.avgDamageShieldedOnTeammates)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageShieldedOnTeammates') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageShieldedOnTeammates')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageShieldedOnTeammates')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-info">{{
                  p.formatChampionGlobalNum(row.avgDamageSelfMitigated)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageSelfMitigated') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageSelfMitigated')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageSelfMitigated')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionHealColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-violet-200">{{
                  p.formatChampionGlobalNum(row.avgTimeCcDealt)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgTimeCcDealt') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgTimeCcDealt')!)
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgTimeCcDealt')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgDamageToChamps)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChamps') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDamageToChamps')!)
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageToChamps')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-text-accent">{{
                  p.formatChampionGlobalNum(row.avgDamageToChampsPhys)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChampsPhys') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageToChampsPhys')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageToChampsPhys')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-violet-300">{{
                  p.formatChampionGlobalNum(row.avgDamageToChampsMagic)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChampsMagic') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageToChampsMagic')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageToChampsMagic')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionDealtColumns && showChampionDealtBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-slate-200">{{
                  p.formatChampionGlobalNum(row.avgDamageToChampsTrue)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageToChampsTrue') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageToChampsTrue')!
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(
                      rowNumericDelta(row, 'avgDamageToChampsTrue')!
                    )
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenTotal)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenTotal') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenTotal')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenTotal')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-text-accent">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenPhys)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenPhys') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenPhys')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenPhys')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-violet-300">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenMagic)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenMagic') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenMagic')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenMagic')!)
                  }}</span
                >
              </div>
              <div
                v-show="p.showChampionTakenColumns && showChampionTakenBreakdown"
                class="champion-global-stat-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0 font-mono text-[13px] leading-tight"
              >
                <span class="font-medium text-slate-200">{{
                  p.formatChampionGlobalNum(row.avgDamageTakenTrue)
                }}</span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    rowNumericDelta(row, 'avgDamageTakenTrue') != null
                  "
                  class="text-[10px] leading-none"
                  :class="
                    p.championGlobalNumericDeltaClass(
                      rowNumericDelta(row, 'avgDamageTakenTrue')!,
                      true
                    )
                  "
                  :title="
                    p.t('statisticsPage.tierListPatchDeltaTitle', {
                      ref: p.championGlobalPatchDeltaRefLabel,
                    })
                  "
                  >{{
                    p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDamageTakenTrue')!)
                  }}</span
                >
              </div>
              <div
                class="champion-global-kda-col tier-list-lolalytics-td flex flex-col items-center justify-center gap-0.5 font-mono text-[13px] leading-tight"
              >
                <span class="font-semibold">
                  {{ p.formatChampionGlobalNum(row.avgKills) }} /
                  {{ p.formatChampionGlobalNum(row.avgDeaths) }} /
                  {{ p.formatChampionGlobalNum(row.avgAssists) }}
                </span>
                <span
                  v-if="
                    p.championGlobalPatchDeltaRefLabel &&
                    (rowNumericDelta(row, 'avgKills') != null ||
                      rowNumericDelta(row, 'avgDeaths') != null ||
                      rowNumericDelta(row, 'avgAssists') != null)
                  "
                  class="text-[10px] leading-none text-text/75"
                >
                  <template v-if="rowNumericDelta(row, 'avgKills') != null">
                    <span
                      :class="p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgKills')!)"
                      >K
                      {{
                        p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgKills')!)
                      }}</span
                    >
                  </template>
                  <template
                    v-if="
                      rowNumericDelta(row, 'avgKills') != null &&
                      rowNumericDelta(row, 'avgDeaths') != null
                    "
                  >
                    <span class="px-1 text-text/45">|</span>
                  </template>
                  <template v-if="rowNumericDelta(row, 'avgDeaths') != null">
                    <span
                      :class="
                        p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgDeaths')!, true)
                      "
                      >D
                      {{
                        p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgDeaths')!)
                      }}</span
                    >
                  </template>
                  <template
                    v-if="
                      (rowNumericDelta(row, 'avgKills') != null ||
                        rowNumericDelta(row, 'avgDeaths') != null) &&
                      rowNumericDelta(row, 'avgAssists') != null
                    "
                  >
                    <span class="px-1 text-text/45">|</span>
                  </template>
                  <template v-if="rowNumericDelta(row, 'avgAssists') != null">
                    <span
                      :class="
                        p.championGlobalNumericDeltaClass(rowNumericDelta(row, 'avgAssists')!)
                      "
                      >A
                      {{
                        p.formatChampionGlobalNumericDelta(rowNumericDelta(row, 'avgAssists')!)
                      }}</span
                    >
                  </template>
                </span>
              </div>
            </template>
          </div>
          <div
            v-if="p.totalChampionGlobalCount > 0"
            class="border-p.t flex flex-wrap items-center justify-between gap-2 border-primary/20 px-4 py-2 text-sm text-text/80"
          >
            <span>{{ p.t('statisticsPage.showing') }} {{ p.totalChampionGlobalCount }}</span>
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5">
                <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
                <select
                  :value="p.championsPageSize"
                  class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                  @change="onChampionPageSizeChange"
                >
                  <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="n" :value="n">{{ n }}</option>
                </select>
              </label>
              <span class="text-text/70">
                {{ (p.championGlobalPage - 1) * p.championsPageSize + 1 }}-{{
                  Math.min(p.championGlobalPage * p.championsPageSize, p.totalChampionGlobalCount)
                }}
                / {{ p.totalChampionGlobalCount }}
              </span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                  :disabled="p.championGlobalPage <= 1"
                  @click="p.onChampionGlobalPageUpdated(Math.max(1, p.championGlobalPage - 1))"
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                  :disabled="p.championGlobalPage >= p.totalChampionGlobalPages"
                  @click="
                    p.onChampionGlobalPageUpdated(
                      Math.min(p.totalChampionGlobalPages, p.championGlobalPage + 1)
                    )
                  "
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.champion-global-table :deep(.tier-list-lolalytics-head),
.champion-global-table :deep(.tier-list-lolalytics-row) {
  width: 100%;
}

.champion-global-table :deep(.champion-global-stat-col) {
  flex: 1 1 0;
  min-width: var(--cg-stat-min, 3.25rem);
  width: auto;
}

.champion-global-table :deep(.champion-global-champ-col) {
  flex: 0 1 var(--cg-champion-min, 220px);
  min-width: var(--cg-champion-min, 220px);
  width: auto;
}

.champion-global-table :deep(.champion-global-kda-col) {
  flex: 0 1 var(--cg-kda-min, 10rem);
  min-width: var(--cg-kda-min, 10rem);
  width: auto;
}
</style>
