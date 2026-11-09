<script setup lang="ts">
import { computed, ref, unref, watch } from 'vue'
import {
  BALANCE_QUICK_FILTERS,
  balanceQuickMatch,
  countBalanceQuick,
  type BalanceQuickFilter,
} from '~/utils/statistics/balanceQuickFilter'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import type { StatisticsMobileSortOption } from '~/components/statistics/StatisticsMobileSortBar.vue'
import { matchesChampionSearch } from '~/utils/multilingualEntitySearch'
import type { BalanceFrameworkRow, BalanceLevelRow } from '~/types/statisticsIndexPage'
import {
  balanceLevelGlyph,
  balanceVerdictRank,
  splitStatusDelta,
} from '~/utils/statistics/balanceVerdict'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()

type BalanceSortKey = 'champion' | 'globalStatus' | 'games'

const balanceSortBy = ref<BalanceSortKey>('globalStatus')
const balanceSortDir = ref<'asc' | 'desc'>('asc')

type LevelRow = BalanceLevelRow
type BalanceRow = BalanceFrameworkRow

const quickFilter = ref<BalanceQuickFilter>('ALL')

type StatusFilter = 'ALL' | 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'

const balanceLevelColumns: Array<{
  key: 'average' | 'skilled' | 'elite'
  label: string
}> = [
  { key: 'average', label: p.t('statisticsPage.balanceLevelAverage') },
  { key: 'skilled', label: p.t('statisticsPage.balanceLevelSkilled') },
  { key: 'elite', label: p.t('statisticsPage.balanceLevelElite') },
]

function balanceRowKey(row: BalanceRow): string {
  return `${row.championId}-${row.role}`
}

const rows = computed<BalanceRow[]>(() => p.balanceFrameworkData?.rows ?? [])
const searchQuery = computed(() => String(p.championSearchQuery ?? '').trim())
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

function fmt(v: number | undefined): string {
  return v !== undefined && Number.isFinite(v) ? v.toFixed(2) : '0.00'
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
    if (!balanceQuickMatch(row, quickFilter.value)) return false
    if (searchQuery.value) {
      const role = String(row.role ?? '').toLowerCase()
      if (
        !matchesChampionSearch(searchQuery.value, {
          championId: row.championId,
          name: p.championName(row.championId),
        }) &&
        !role.includes(searchQuery.value.toLowerCase())
      ) {
        return false
      }
    }
    const gf = p.balanceGlobalFilter ?? 'ALL'
    const af = p.balanceAverageFilter ?? 'ALL'
    const sf = p.balanceSkilledFilter ?? 'ALL'
    const ef = p.balanceEliteFilter ?? 'ALL'
    if (!statusMatches(row.globalStatus, gf)) return false
    const needFilter = String(p.balanceNeedFilter ?? 'ALL')
    if (needFilter !== 'ALL' && frameworkNeedCode(row.globalStatus) !== needFilter) return false
    if (!statusMatches(row.average.status, af)) return false
    if (!statusMatches(row.skilled.status, sf)) return false
    if (!statusMatches(row.elite.status, ef)) return false
    return true
  })

  const dir = balanceSortDir.value === 'asc' ? 1 : -1
  const key = balanceSortBy.value
  out.sort((a, b) => {
    if (key === 'champion') {
      const an = String(p.championName(a.championId) || a.championId).toLowerCase()
      const bn = String(p.championName(b.championId) || b.championId).toLowerCase()
      if (an === bn) return 0
      return dir * (an < bn ? -1 : 1)
    }
    if (key === 'globalStatus') {
      const av = balanceVerdictRank(a.globalStatus)
      const bv = balanceVerdictRank(b.globalStatus)
      if (av !== bv) return dir * (av - bv)
      const an = String(p.championName(a.championId) || a.championId).toLowerCase()
      const bn = String(p.championName(b.championId) || b.championId).toLowerCase()
      return an < bn ? -1 : an > bn ? 1 : 0
    }
    return dir * (rowGamesScore(a) - rowGamesScore(b))
  })
  return out
})

const balanceMobileSortOptions = computed<StatisticsMobileSortOption[]>(() => [
  { value: 'champion', label: p.t('statisticsPage.mobileSortBalanceChampion') },
  { value: 'globalStatus', label: p.t('statisticsPage.mobileSortBalanceGlobal') },
  { value: 'games', label: p.t('statisticsPage.mobileSortBalanceGames') },
])

const balancePage = ref(1)
const pageSize = computed(() => Number(unref(p.championsPageSize) ?? 20))
const quickCounts = computed(() => {
  const roleFilter = String(p.statsRoleFilter ?? '').trim()
  return countBalanceQuick(roleFilter ? rows.value : collapseToMainRolePerChampion(rows.value))
})

const quickLabelKeys: Record<BalanceQuickFilter, string> = {
  ALL: 'statisticsPage.balanceQuickAll',
  NERF: 'statisticsPage.balanceQuickNerf',
  BUFF: 'statisticsPage.balanceQuickBuff',
  CHANGED: 'statisticsPage.balanceQuickChanged',
}

const previousPatch = computed(() => p.balanceFrameworkData?.previousPatch ?? '')

function quickLabel(f: BalanceQuickFilter): string {
  if (f === 'CHANGED' && previousPatch.value) {
    return p.t('statisticsPage.balanceQuickChangedSince', { patch: previousPatch.value })
  }
  return p.t(quickLabelKeys[f])
}

function verdictLabel(v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'): string {
  if (v === 'OVERPOWERED') return `▲ ${p.t('statisticsPage.balanceVerdictNerf')}`
  if (v === 'UNDERPOWERED') return `▼ ${p.t('statisticsPage.balanceVerdictBuff')}`
  return p.t('statisticsPage.balanceStatusBalanced')
}

function sinceLabel(delta: string | null): string {
  const parts = splitStatusDelta(delta)
  if (!parts) return '—'
  return `${statusCodeToLabel(parts[0])} → ${statusCodeToLabel(parts[1])}`
}

const totalRowsCount = computed(() => filteredRows.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalRowsCount.value / pageSize.value)))
const paginatedRows = computed(() => {
  const pnum = Math.min(balancePage.value, totalPages.value)
  const start = (pnum - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

watch([filteredRows, pageSize, balanceSortBy, balanceSortDir], () => {
  balancePage.value = 1
})

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
  <div class="space-y-5 pt-2 md:pt-8">
    <div v-if="p.balanceFrameworkPending" class="text-text/70">
      {{ p.t('statisticsPage.loading') }}
    </div>
    <div v-else-if="p.balanceFrameworkError" class="rounded border border-error/50 p-3 text-error">
      {{ p.t('statisticsPage.overviewDetailTimeout') }}
    </div>
    <template v-else>
      <div class="ba-bar">
        <span class="ba-bar__label">{{ p.t('statisticsPage.balanceShow') }}</span>
        <div
          class="balance-quick"
          role="group"
          :aria-label="p.t('statisticsPage.balanceQuickAria')"
        >
          <button
            v-for="f in BALANCE_QUICK_FILTERS"
            :key="f"
            type="button"
            class="balance-quick-btn"
            :class="[`is-${f.toLowerCase()}`, { 'is-active': quickFilter === f }]"
            :aria-pressed="quickFilter === f"
            @click="quickFilter = f"
          >
            <span v-if="f === 'NERF'" aria-hidden="true">▲</span>
            <span v-else-if="f === 'BUFF'" aria-hidden="true">▼</span>
            {{ quickLabel(f) }}
            <template v-if="f === 'ALL'"> · {{ quickCounts[f] }}</template>
          </button>
        </div>
        <ul class="ba-legend">
          <li class="is-op">
            ▲ <span>{{ p.t('statisticsPage.balanceStatusOverpowered') }}</span>
          </li>
          <li class="is-eq">
            = <span>{{ p.t('statisticsPage.balanceStatusBalanced') }}</span>
          </li>
          <li class="is-up">
            ▼ <span>{{ p.t('statisticsPage.balanceStatusUnderpowered') }}</span>
          </li>
        </ul>
      </div>
      <div v-if="paginatedRows.length" class="statistics-balance-tab space-y-3">
        <StatisticsMobileSortBar
          id="balance-mobile-sort"
          v-model:column="balanceSortBy"
          v-model:direction="balanceSortDir"
          class="ba-msortbar"
          :options="balanceMobileSortOptions"
          :asc-default-columns="['champion']"
        />
        <div class="ba-mlist md:hidden">
          <div class="ba-mhead">
            <span>{{ p.t('statisticsPage.balanceMobileAxis') }}</span>
            <span class="ba-mhead-cols">
              <span>{{ p.t('statisticsPage.balanceLevelAverageShort') }}</span>
              <span>{{ p.t('statisticsPage.balanceLevelSkilledShort') }}</span>
              <span>{{ p.t('statisticsPage.balanceLevelElite') }}</span>
            </span>
          </div>
          <StatisticsChampionDetailLink
            v-for="row in paginatedRows"
            :key="'balance-mobile-' + balanceRowKey(row)"
            :champion-id="row.championId"
            class="ba-mcard"
          >
            <div class="ba-mcard-row">
              <div class="min-w-0">
                <div class="ba-mcard-name">{{ p.championName(row.championId) }}</div>
                <div class="ba-mcard-role">{{ p.mainRoleLabel(row.role) }}</div>
              </div>
              <div class="ba-mcard-lvls">
                <span
                  v-for="level in balanceLevelColumns"
                  :key="'bam-' + level.key"
                  class="ba-glyph"
                  :class="'is-' + balanceLevelGlyph(row[level.key].status).tone"
                  :aria-label="`${level.label} : ${statusLabel(row[level.key].status)}`"
                >
                  {{ balanceLevelGlyph(row[level.key].status).glyph }}
                </span>
              </div>
            </div>
            <div class="ba-mcard-row">
              <span class="ba-verdict" :class="'is-' + balanceLevelGlyph(row.globalStatus).tone">
                {{ verdictLabel(row.globalStatus) }}
              </span>
              <span class="ba-mcard-since" :class="{ 'is-same': !row.globalDelta }">
                {{
                  row.globalDelta
                    ? sinceLabel(row.globalDelta)
                    : p.t('statisticsPage.balanceUnchanged')
                }}
              </span>
            </div>
          </StatisticsChampionDetailLink>
        </div>

        <div class="ba-card hidden md:block">
          <div class="ba-scroll">
            <table class="ba-table">
              <thead>
                <tr class="ba-group-row">
                  <th colspan="2"></th>
                  <th colspan="3" class="ba-group">
                    <span>{{ p.t('statisticsPage.balanceLevelsGroup') }}</span>
                  </th>
                  <th colspan="2"></th>
                </tr>
                <tr>
                  <th :title="p.t('statisticsPage.balanceTooltipChampion')">
                    {{ p.t('statisticsPage.tierListColChampion') }}
                  </th>
                  <th :title="p.t('statisticsPage.balanceTooltipRole')">
                    {{ p.t('statisticsPage.tierListRole') }}
                  </th>
                  <th
                    v-for="level in balanceLevelColumns"
                    :key="'ba-h-' + level.key"
                    class="ba-lvl"
                    :title="
                      p.t(
                        level.key === 'average'
                          ? 'statisticsPage.balanceTooltipAverage'
                          : level.key === 'skilled'
                            ? 'statisticsPage.balanceTooltipSkilled'
                            : 'statisticsPage.balanceTooltipElite'
                      )
                    "
                  >
                    {{ level.label }}
                  </th>
                  <th :title="p.t('statisticsPage.balanceTooltipGlobal')">
                    {{ p.t('statisticsPage.balanceVerdict') }}
                  </th>
                  <th :title="p.t('statisticsPage.balanceTooltipGlobalDelta')">
                    {{
                      previousPatch
                        ? p.t('statisticsPage.balanceSince', { patch: previousPatch })
                        : p.t('statisticsPage.balanceAbbrevDelta')
                    }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in paginatedRows" :key="`${row.championId}-${row.role}`">
                  <td>
                    <StatisticsChampionDetailLink :champion-id="row.championId" class="ba-champ">
                      <img
                        v-if="p.gameVersion && p.championByKey(row.championId)"
                        loading="lazy"
                        decoding="async"
                        :src="
                          p.getChampionImageUrl(
                            p.gameVersion,
                            p.championByKey(row.championId)!.image.full
                          )
                        "
                        :alt="p.championName(row.championId) ?? undefined"
                        width="28"
                        height="28"
                      />
                      <span>{{ p.championName(row.championId) }}</span>
                    </StatisticsChampionDetailLink>
                  </td>
                  <td class="ba-role">{{ p.mainRoleLabel(row.role) }}</td>
                  <td
                    v-for="level in balanceLevelColumns"
                    :key="'ba-c-' + level.key"
                    class="ba-lvl"
                  >
                    <span
                      class="ba-glyph"
                      :class="'is-' + balanceLevelGlyph(row[level.key].status).tone"
                      :title="levelTooltip(row, level.key)"
                      :aria-label="statusLabel(row[level.key].status)"
                    >
                      {{ balanceLevelGlyph(row[level.key].status).glyph }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="ba-verdict"
                      :class="'is-' + balanceLevelGlyph(row.globalStatus).tone"
                      :title="globalTooltip(row)"
                    >
                      {{ verdictLabel(row.globalStatus) }}
                    </span>
                  </td>
                  <td class="ba-since">{{ sinceLabel(row.globalDelta) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <StatisticsRangePagination
          v-model:page="balancePage"
          :page-size="pageSize"
          class="statistics-balance-pagination ba-pagination"
          :total-count="totalRowsCount"
          :total-pages="totalPages"
          @update:page-size="p.onBansPageSizeUpdated"
        >
          {{ p.t('statisticsPage.showing') }} {{ totalRowsCount }}
        </StatisticsRangePagination>
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
.ba-mlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ba-mhead {
  display: flex;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 11px;
  color: #a09b8c;
}
.ba-mhead-cols,
.ba-mcard-lvls {
  display: grid;
  grid-template-columns: repeat(3, 40px);
  gap: 6px;
  text-align: center;
}
.ba-mcard {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #463714;
  border-radius: 12px;
  background: #0a1428;
  color: #f0e6d2;
}
.ba-mcard-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.ba-mcard-name {
  font-weight: 600;
  font-size: 14px;
}
.ba-mcard-role {
  font-size: 11px;
  color: #a09b8c;
}
.ba-mcard-lvls .ba-glyph {
  width: 40px;
}
.ba-mcard-since {
  font-size: 12px;
  text-align: right;
}
.ba-mcard-since.is-same {
  color: #a09b8c;
}
@media (max-width: 767px) {
  .ba-msortbar,
  .ba-legend,
  .ba-bar__label {
    display: none !important;
  }
  .ba-bar .balance-quick {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .ba-bar .balance-quick-btn {
    flex-shrink: 0;
  }
}
.ba-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}
.ba-bar__label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a09b8c;
}
.balance-quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.balance-quick-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid #1e2328;
  border-radius: 999px;
  font-size: 14px;
  color: #f0e6d2;
  background: transparent;
}
.balance-quick-btn.is-nerf {
  border-color: rgb(226 102 90 / 0.6);
  color: #e2665a;
}
.balance-quick-btn.is-buff {
  border-color: rgb(10 200 185 / 0.6);
  color: #0ac8b9;
}
.balance-quick-btn.is-active {
  background: #0a323c;
  border-color: #0a323c;
  color: #f0e6d2;
  font-weight: 600;
}
.ba-legend {
  display: flex;
  gap: 16px;
  margin-left: auto;
  font-size: 12px;
  color: #a09b8c;
}
.ba-legend .is-op {
  color: #e2665a;
}
.ba-legend .is-up {
  color: #0ac8b9;
}
.ba-legend span {
  color: #a09b8c;
}
.ba-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  overflow: hidden;
}
.ba-scroll {
  overflow-x: auto;
}
.ba-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 14px;
  color: #f0e6d2;
}
.ba-table th {
  padding: 10px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #a09b8c;
  text-align: left;
  border-bottom: 1px solid #0a323c;
  white-space: nowrap;
}
.ba-group-row th {
  border-bottom: 0;
  padding-bottom: 0;
}
.ba-group span {
  display: block;
  padding-bottom: 6px;
  border-bottom: 1px solid #0a323c;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ba-table td {
  padding: 9px 20px;
  border-bottom: 1px solid #1e2328;
  vertical-align: middle;
}
.ba-table tbody tr:last-child td {
  border-bottom: 0;
}
.ba-table th.ba-lvl,
.ba-table td.ba-lvl {
  text-align: center;
}
.ba-champ {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-weight: 600;
  color: #f0e6d2;
}
.ba-champ img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
}
.ba-role {
  color: #a09b8c;
}
.ba-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 28px;
  border-radius: 6px;
  font-size: 12px;
  background: #1e2328;
  color: #a09b8c;
}
.ba-glyph.is-op {
  background: #5a1e1a;
  color: #e2665a;
}
.ba-glyph.is-up {
  background: #0a323c;
  color: #0ac8b9;
}
.ba-verdict {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #1e2328;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.ba-verdict.is-op {
  border-color: rgb(226 102 90 / 0.6);
  color: #e2665a;
}
.ba-verdict.is-up {
  border-color: rgb(10 200 185 / 0.6);
  color: #0ac8b9;
}
.ba-since {
  white-space: nowrap;
}
</style>
