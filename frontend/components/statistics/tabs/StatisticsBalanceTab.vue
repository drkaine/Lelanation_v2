<script setup lang="ts">
import { computed, inject, ref, unref, watch } from 'vue'

const p = inject('statisticsPageCtx') as any

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

function isOtpRoleRow(row: BalanceRow): boolean {
  const pickMax = Math.max(
    Number(row.average?.pickrate ?? 0),
    Number(row.skilled?.pickrate ?? 0),
    Number(row.elite?.pickrate ?? 0)
  )
  return pickMax < 1
}

const filteredRows = computed<BalanceRow[]>(() => {
  const out = rows.value.filter(row => {
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
    const otpFilter = String(p.statsOtpFilter ?? 'non')
    const isOtpRole = isOtpRoleRow(row)
    if (otpFilter === 'non' && isOtpRole) return false
    if (otpFilter === 'solo' && !isOtpRole) return false
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
      <div
        v-if="paginatedRows.length"
        class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
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
                  <span class="font-medium text-accent">{{ p.championName(row.championId) }}</span>
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
        <div
          v-if="totalRowsCount > 0"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-primary/20 px-4 py-2 text-sm text-text/80"
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
