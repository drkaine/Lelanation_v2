<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue'
const p = inject('statisticsPageCtx') as any
const expandedBalanceKeys = ref<Set<string>>(new Set())

type LevelRow = {
  status: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
  delta: string | null
  games: number
  winrate: number
  pickrate: number
  banrate: number
  presence: number
}

type BalanceRow = {
  championId: number
  role: string
  average: LevelRow
  skilled: LevelRow
  elite: LevelRow
  globalStatus: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
  globalDelta: string | null
}

type StatusFilter = 'ALL' | 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'

const balanceLevelColumns: Array<{
  key: 'average' | 'skilled' | 'elite'
  label: string
}> = [
  { key: 'average', label: 'Average' },
  { key: 'skilled', label: 'Skilled' },
  { key: 'elite', label: 'Elite' },
]

function balanceRowKey(row: BalanceRow): string {
  return `${row.championId}-${row.role}`
}

function toggleBalanceCardExpanded(row: BalanceRow): void {
  const key = balanceRowKey(row)
  const next = new Set(expandedBalanceKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedBalanceKeys.value = next
}

const rows = computed<BalanceRow[]>(() => p.balanceFrameworkData?.rows ?? [])
const searchQuery = computed(() =>
  String(p.championSearchQuery ?? '')
    .trim()
    .toLowerCase()
)
const rules = computed(() => p.balanceFrameworkData?.rules ?? null)
const abrByLevel = computed<{
  average: number
  skilled: number
  elite: number
}>(() => p.balanceFrameworkData?.abrByLevel ?? { average: 0, skilled: 0, elite: 0 })

function statusMatches(
  value: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED',
  filter: StatusFilter
): boolean {
  return filter === 'ALL' || value === filter
}

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

function fmt3(v: number): string {
  return Number.isFinite(v) ? v.toFixed(3) : '0.000'
}

function relationToOp(row: LevelRow, level: 'average' | 'skilled' | 'elite'): string {
  const r = rules.value?.levels?.[level]
  if (!r) return ''
  const op = r.overpowered
  const abr = abrByLevel.value[level] || 0
  const ratio = abr > 0 ? row.banrate / abr : 0
  if (level === 'elite') {
    return p.t('statisticsPage.balanceTooltipRelationOpElite', {
      winrate: fmt(row.winrate),
      wrHigh: fmt(op.winrateHigh),
      banrate: fmt3(row.banrate),
      ratio: fmt3(ratio),
      presence: fmt(row.presence),
    })
  }
  return p.t('statisticsPage.balanceTooltipRelationOp', {
    winrate: fmt(row.winrate),
    wrHigh: fmt(op.winrateHigh),
    banrate: fmt3(row.banrate),
    ratio: fmt3(ratio),
    wrLow: fmt(r.underpowered.winrateMax),
  })
}

function relationToUp(row: LevelRow, level: 'average' | 'skilled' | 'elite'): string {
  const r = rules.value?.levels?.[level]
  if (!r) return ''
  if (level === 'elite') {
    const upPresence = Number(r.underpowered.presenceMax ?? 0)
    return p.t('statisticsPage.balanceTooltipRelationUpElite', {
      delta: (row.presence - upPresence).toFixed(2),
    })
  }
  const up = Number(r.underpowered.winrateMax ?? 0)
  return p.t('statisticsPage.balanceTooltipRelationUp', {
    delta: (row.winrate - up).toFixed(2),
  })
}

function statusLabel(v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'): string {
  if (v === 'OVERPOWERED') return p.t('statisticsPage.balanceStatusOverpowered')
  if (v === 'UNDERPOWERED') return p.t('statisticsPage.balanceStatusUnderpowered')
  return p.t('statisticsPage.balanceStatusBalanced')
}

function statusCodeToLabel(v: string): string {
  const code = String(v || '')
    .trim()
    .toUpperCase()
  if (code === 'OVERPOWERED') return statusLabel('OVERPOWERED')
  if (code === 'UNDERPOWERED') return statusLabel('UNDERPOWERED')
  if (code === 'BALANCED') return statusLabel('BALANCED')
  return v
}

function formatDeltaLabel(v: string | null): string {
  if (!v) return '—'
  const parts = String(v)
    .split('->')
    .map(x => x.trim())
    .filter(Boolean)
  if (parts.length === 2) {
    return `${statusCodeToLabel(parts[0] ?? '')} -> ${statusCodeToLabel(parts[1] ?? '')}`
  }
  return statusCodeToLabel(v)
}

function statusClass(v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'): string {
  if (v === 'OVERPOWERED') return 'text-error'
  if (v === 'UNDERPOWERED') return 'text-sky-300'
  return 'text-success'
}

function frameworkNeedLabel(v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'): string {
  if (v === 'OVERPOWERED') return p.t('statisticsPage.balanceNeedNerf')
  if (v === 'UNDERPOWERED') return p.t('statisticsPage.balanceNeedBuff')
  return p.t('statisticsPage.balanceNeedNormal')
}

function frameworkNeedCode(
  v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
): 'NERF' | 'BUFF' | 'NORMAL' {
  if (v === 'OVERPOWERED') return 'NERF'
  if (v === 'UNDERPOWERED') return 'BUFF'
  return 'NORMAL'
}

function rowGamesScore(row: BalanceRow): number {
  return Math.max(
    Number(row.average?.games ?? 0),
    Number(row.skilled?.games ?? 0),
    Number(row.elite?.games ?? 0)
  )
}

/** Sans filtre rôle : une ligne par champion (rôle le plus joué). */
function collapseToMainRolePerChampion(list: BalanceRow[]): BalanceRow[] {
  const byChampion = new Map<number, BalanceRow>()
  for (const row of list) {
    const prev = byChampion.get(row.championId)
    if (!prev || rowGamesScore(row) > rowGamesScore(prev)) {
      byChampion.set(row.championId, row)
    }
  }
  return [...byChampion.values()]
}

const filteredRows = computed<BalanceRow[]>(() => {
  const roleFilter = String(p.statsRoleFilter ?? '').trim()
  const source = roleFilter ? rows.value : collapseToMainRolePerChampion(rows.value)
  const out = source.filter(row => {
    if (searchQuery.value) {
      const champ = String(p.championName(row.championId) ?? '').toLowerCase()
      const role = String(row.role ?? '').toLowerCase()
      if (!champ.includes(searchQuery.value) && !role.includes(searchQuery.value)) return false
    }
    const gf = (p.balanceGlobalFilter as StatusFilter) ?? 'ALL'
    const af = (p.balanceAverageFilter as StatusFilter) ?? 'ALL'
    const sf = (p.balanceSkilledFilter as StatusFilter) ?? 'ALL'
    const ef = (p.balanceEliteFilter as StatusFilter) ?? 'ALL'
    if (!statusMatches(row.globalStatus, gf)) return false
    const needFilter = String(p.balanceNeedFilter ?? 'ALL')
    if (needFilter !== 'ALL' && frameworkNeedCode(row.globalStatus) !== needFilter) return false
    if (!statusMatches(row.average.status, af)) return false
    if (!statusMatches(row.skilled.status, sf)) return false
    if (!statusMatches(row.elite.status, ef)) return false
    return true
  })

  out.sort((a, b) => {
    const an = String(p.championName(a.championId) || a.championId).toLowerCase()
    const bn = String(p.championName(b.championId) || b.championId).toLowerCase()
    if (an === bn) return 0
    return an < bn ? -1 : 1
  })
  return out
})

const balancePage = ref(1)
const pageSize = computed(() => Number(unref(p.championsPageSize) ?? 20))
const totalRowsCount = computed(() => filteredRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value)))
const paginatedRows = computed(() => {
  const pnum = Math.min(balancePage.value, totalPages.value)
  const start = (pnum - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

watch([filteredRows, pageSize], () => {
  balancePage.value = 1
})

function onPageSizeChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const fallback = unref(p.championsPageSize)
  p.onBansPageSizeUpdated(Number(target?.value ?? fallback))
}

function levelTooltip(row: BalanceRow, level: 'average' | 'skilled' | 'elite'): string {
  const lv = row[level]
  if (!lv || lv.games <= 0) return p.t('statisticsPage.balanceTooltipNoGames')
  return [
    p.t('statisticsPage.balanceTooltipStatus', { status: statusLabel(lv.status) }),
    relationToOp(lv, level),
    relationToUp(lv, level),
    lv.delta
      ? p.t('statisticsPage.balanceTooltipStatusChange', { delta: formatDeltaLabel(lv.delta) })
      : p.t('statisticsPage.balanceTooltipStatusUnchanged'),
  ].join(' ')
}

function globalTooltip(row: BalanceRow): string {
  return row.globalDelta
    ? p.t('statisticsPage.balanceTooltipGlobalStatusChange', {
        status: statusLabel(row.globalStatus),
        delta: formatDeltaLabel(row.globalDelta),
      })
    : p.t('statisticsPage.balanceTooltipGlobalStatus', { status: statusLabel(row.globalStatus) })
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="p.balanceFrameworkPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.balanceFrameworkError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <template v-else>
      <div v-if="paginatedRows.length" class="statistics-balance-tab space-y-3">
        <div class="statistics-balance-mobile-list space-y-2 md:hidden">
          <article
            v-for="row in paginatedRows"
            :key="'balance-mobile-' + balanceRowKey(row)"
            class="statistics-champion-stats-mobile-card statistics-balance-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
          >
            <button
              type="button"
              class="statistics-champion-stats-mobile-card-header flex w-full items-center gap-3 p-3 text-left"
              @click="toggleBalanceCardExpanded(row)"
            >
              <StatisticsChampionStatsMobileCardHeader
                :champion-id="row.championId"
                :champion-name="String(p.championName(row.championId) || row.championId)"
                :search-query="p.championSearchQuery"
                :role-label="p.mainRoleLabel(row.role)"
                :role-icon-src="p.mainRoleIconSrc(row.role)"
                :portrait-src="
                  p.gameVersion && p.championByKey(row.championId)
                    ? p.getChampionImageUrl(
                        p.gameVersion,
                        p.championByKey(row.championId)!.image.full
                      )
                    : null
                "
                :portrait-alt="p.championName(row.championId) || ''"
                :detail-to="
                  p.gameVersion && p.championByKey(row.championId)
                    ? p.localePath(
                        `/statistics/champion/${encodeURIComponent(String(row.championId))}`
                      )
                    : null
                "
              />
              <div class="flex min-w-0 flex-1 flex-col items-end justify-center text-right">
                <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
                  {{ p.t('statisticsPage.balanceGlobalStatus') }}
                </div>
                <div class="text-lg font-bold leading-tight" :class="statusClass(row.globalStatus)">
                  {{ statusLabel(row.globalStatus) }}
                </div>
                <div class="mt-0.5 text-xs text-text/55">
                  {{ frameworkNeedLabel(row.globalStatus) }}
                </div>
                <div
                  v-if="row.globalDelta"
                  class="mt-0.5 max-w-[9rem] text-[10px] leading-snug text-text/70"
                >
                  {{ formatDeltaLabel(row.globalDelta) }}
                </div>
              </div>
              <span
                class="shrink-0 text-xs text-text/50 transition-transform duration-200"
                :class="expandedBalanceKeys.has(balanceRowKey(row)) ? 'rotate-180' : ''"
                aria-hidden="true"
                >▼</span
              >
            </button>

            <div class="statistics-balance-mobile-levels border-t border-primary/15 px-3 py-2.5">
              <div class="grid grid-cols-3 gap-2">
                <div
                  v-for="level in balanceLevelColumns"
                  :key="'balance-mobile-lvl-' + balanceRowKey(row) + '-' + level.key"
                  class="flex min-w-0 flex-col items-center gap-0.5 text-center"
                >
                  <span class="text-[10px] font-semibold uppercase tracking-wide text-text/55">
                    {{ level.label }}
                  </span>
                  <span
                    class="text-xs font-semibold leading-tight"
                    :class="statusClass(row[level.key].status)"
                    :title="levelTooltip(row, level.key)"
                  >
                    {{ statusLabel(row[level.key].status) }}
                  </span>
                  <span
                    v-if="row[level.key].delta"
                    class="max-w-full truncate text-[10px] leading-snug text-text/60"
                  >
                    {{ formatDeltaLabel(row[level.key].delta) }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-if="expandedBalanceKeys.has(balanceRowKey(row))"
              class="statistics-balance-mobile-details space-y-2 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-xs text-text/85"
            >
              <div
                v-for="level in balanceLevelColumns"
                :key="'balance-mobile-detail-' + balanceRowKey(row) + '-' + level.key"
                class="rounded-md bg-black/15 px-2 py-1.5"
              >
                <div class="font-semibold text-text">{{ level.label }}</div>
                <template v-if="row[level.key].games > 0">
                  <div class="mt-1 tabular-nums">
                    WR {{ fmt(row[level.key].winrate) }}% · BR {{ fmt3(row[level.key].banrate) }}% ·
                    PR {{ fmt(row[level.key].presence) }}%
                  </div>
                  <div class="mt-0.5 text-text/70">{{ levelTooltip(row, level.key) }}</div>
                </template>
                <div v-else class="mt-1 text-text/55">
                  {{ p.t('statisticsPage.balanceTooltipNoGames') }}
                </div>
              </div>
              <div class="text-text/70" :title="globalTooltip(row)">
                {{ globalTooltip(row) }}
              </div>
            </div>
          </article>
        </div>

        <div
          class="statistics-overview-surface hidden w-full overflow-x-auto rounded-lg border border-primary/30 md:block"
        >
          <table class="w-full min-w-[900px] text-left text-sm">
            <thead class="border-b border-primary/30 bg-black/25">
              <tr>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipChampion')"
                >
                  {{ p.t('statisticsPage.tierListColChampion') }}
                </th>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipRole')"
                >
                  {{ p.t('statisticsPage.tierListRole') }}
                </th>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipAverage')"
                >
                  Average
                </th>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipSkilled')"
                >
                  Skilled
                </th>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipElite')"
                >
                  Elite
                </th>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipGlobal')"
                >
                  {{ p.t('statisticsPage.balanceGlobalStatus') }}
                </th>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipNeed')"
                >
                  {{ p.t('statisticsPage.balanceNeedColumn') }}
                </th>
                <th
                  class="px-3 py-2 font-semibold text-text"
                  :title="p.t('statisticsPage.balanceTooltipGlobalDelta')"
                >
                  {{ p.t('statisticsPage.balanceAbbrevDelta') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="row in paginatedRows"
                :key="`${row.championId}-${row.role}`"
                class="odd:bg-white/[0.04] even:bg-black/25 hover:brightness-110"
              >
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="p.gameVersion && p.championByKey(row.championId)"
                      :src="
                        p.getChampionImageUrl(
                          p.gameVersion,
                          p.championByKey(row.championId)!.image.full
                        )
                      "
                      :alt="p.championName(row.championId)"
                      class="h-8 w-8 rounded border border-black/30 object-cover"
                      width="32"
                      height="32"
                    />
                    <span class="font-medium text-accent">{{
                      p.championName(row.championId)
                    }}</span>
                  </div>
                </td>
                <td class="px-3 py-2 text-text/90">{{ row.role }}</td>
                <td
                  class="px-3 py-2 font-medium"
                  :class="statusClass(row.average.status)"
                  :title="levelTooltip(row, 'average')"
                >
                  {{ statusLabel(row.average.status) }}
                </td>
                <td
                  class="px-3 py-2 font-medium"
                  :class="statusClass(row.skilled.status)"
                  :title="levelTooltip(row, 'skilled')"
                >
                  {{ statusLabel(row.skilled.status) }}
                </td>
                <td
                  class="px-3 py-2 font-medium"
                  :class="statusClass(row.elite.status)"
                  :title="levelTooltip(row, 'elite')"
                >
                  {{ statusLabel(row.elite.status) }}
                </td>
                <td
                  class="px-3 py-2 font-semibold"
                  :class="statusClass(row.globalStatus)"
                  :title="globalTooltip(row)"
                >
                  {{ statusLabel(row.globalStatus) }}
                </td>
                <td class="px-3 py-2 text-text/90">
                  {{ frameworkNeedLabel(row.globalStatus) }}
                </td>
                <td class="px-3 py-2 text-text/80">
                  {{ formatDeltaLabel(row.globalDelta) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="totalRowsCount > 0"
          class="statistics-balance-pagination flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-surface/20 px-3 py-2 text-sm text-text/80 md:rounded-none md:border-t md:bg-transparent md:px-4"
        >
          <span>{{ p.t('statisticsPage.showing') }} {{ totalRowsCount }}</span>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-1.5">
              <span class="text-text/70">{{ p.t('statisticsPage.perPage') }}</span>
              <select
                :value="p.championsPageSize"
                class="rounded border border-primary/40 bg-background px-2 py-1 text-text"
                @change="onPageSizeChange"
              >
                <option v-for="n in p.PAGE_SIZE_OPTIONS" :key="'balance-ps-' + n" :value="n">
                  {{ n }}
                </option>
              </select>
            </label>
            <span class="text-text/70">
              {{ (balancePage - 1) * pageSize + 1 }}-{{
                Math.min(balancePage * pageSize, totalRowsCount)
              }}
              / {{ totalRowsCount }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="balancePage <= 1"
                @click="balancePage = Math.max(1, balancePage - 1)"
              >
                ‹
              </button>
              <button
                type="button"
                class="rounded border border-primary/40 bg-surface/50 px-2 py-1 text-text disabled:opacity-50"
                :disabled="balancePage >= totalPages"
                @click="balancePage = Math.min(totalPages, balancePage + 1)"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-text/70">
        {{ p.t('statisticsPage.overviewDetailNoData') }}
        <span v-if="p.balanceFrameworkData?.currentPatch" class="block text-xs text-text/55">
          {{ p.balanceFrameworkData.currentPatch }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
@media (max-width: 768px) {
  .statistics-balance-tab {
    margin-inline: -1rem;
    width: calc(100% + 2rem);
    max-width: 100vw;
  }

  .statistics-balance-mobile-card {
    width: 100%;
  }
}
</style>
