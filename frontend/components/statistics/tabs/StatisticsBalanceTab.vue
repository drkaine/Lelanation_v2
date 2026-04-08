<script setup lang="ts">
import { computed, inject, ref } from 'vue'

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

const globalFilter = ref<StatusFilter>('ALL')
const averageFilter = ref<StatusFilter>('ALL')
const skilledFilter = ref<StatusFilter>('ALL')
const eliteFilter = ref<StatusFilter>('ALL')

const rows = computed<BalanceRow[]>(() => p.balanceFrameworkData?.rows ?? [])
const previousPatch = computed<string | null>(() => p.balanceFrameworkData?.previousPatch ?? null)
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

function filterLabel(v: StatusFilter): string {
  if (v === 'ALL') return p.t('statisticsPage.overviewVersionAll')
  if (v === 'OVERPOWERED') return p.t('statisticsPage.balanceStatusOverpowered')
  if (v === 'UNDERPOWERED') return p.t('statisticsPage.balanceStatusUnderpowered')
  return p.t('statisticsPage.balanceStatusBalanced')
}

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00'
}

function relationToOp(row: LevelRow, level: 'average' | 'skilled' | 'elite'): string {
  const r = rules.value?.levels?.[level]
  if (!r) return ''
  const op = r.overpowered
  const abr = abrByLevel.value[level] || 0
  const ratio = abr > 0 ? row.banrate / abr : 0
  if (level === 'elite') {
    return `WR ${fmt(row.winrate)}% (seuil OP ${fmt(op.winrateHigh)}%) | BR ${fmt(row.banrate)}% (${fmt(ratio)}x ABR) | PRÉS ${fmt(row.presence)}%`
  }
  return `WR ${fmt(row.winrate)}% (OP ${fmt(op.winrateHigh)}%) | BR ${fmt(row.banrate)}% (${fmt(ratio)}x ABR) | UP < ${fmt(r.underpowered.winrateMax)}%`
}

function relationToUp(row: LevelRow, level: 'average' | 'skilled' | 'elite'): string {
  const r = rules.value?.levels?.[level]
  if (!r) return ''
  if (level === 'elite') {
    const upPresence = Number(r.underpowered.presenceMax ?? 0)
    return `Distance UP (présence): ${(row.presence - upPresence).toFixed(2)} pts`
  }
  const up = Number(r.underpowered.winrateMax ?? 0)
  return `Distance UP (WR): ${(row.winrate - up).toFixed(2)} pts`
}

function statusLabel(v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'): string {
  if (v === 'OVERPOWERED') return p.t('statisticsPage.balanceStatusOverpowered')
  if (v === 'UNDERPOWERED') return p.t('statisticsPage.balanceStatusUnderpowered')
  return p.t('statisticsPage.balanceStatusBalanced')
}

function statusClass(v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'): string {
  if (v === 'OVERPOWERED') return 'text-error'
  if (v === 'UNDERPOWERED') return 'text-sky-300'
  return 'text-success'
}

function deltaClass(v: string | null): string {
  if (!v) return 'text-text/55'
  if (v.includes('OVERPOWERED')) return 'text-error'
  if (v.includes('UNDERPOWERED')) return 'text-sky-300'
  return 'text-success'
}

function rankStatus(v: 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'): number {
  if (v === 'OVERPOWERED') return 0
  if (v === 'UNDERPOWERED') return 1
  return 2
}

const filteredRows = computed<BalanceRow[]>(() => {
  const out = rows.value.filter(row => {
    if (!statusMatches(row.globalStatus, globalFilter.value)) return false
    if (!statusMatches(row.average.status, averageFilter.value)) return false
    if (!statusMatches(row.skilled.status, skilledFilter.value)) return false
    if (!statusMatches(row.elite.status, eliteFilter.value)) return false
    return true
  })

  out.sort((a, b) => {
    const s = rankStatus(a.globalStatus) - rankStatus(b.globalStatus)
    if (s !== 0) return s
    const an = String(p.championName(a.championId) || a.championId).toLowerCase()
    const bn = String(p.championName(b.championId) || b.championId).toLowerCase()
    if (an === bn) return 0
    return an < bn ? -1 : 1
  })
  return out
})
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
        class="grid grid-cols-1 gap-2 rounded-lg border border-primary/30 bg-surface/30 p-3 md:grid-cols-4"
      >
        <label class="text-xs text-text/80">
          {{ p.t('statisticsPage.balanceGlobalStatus') }}
          <select
            v-model="globalFilter"
            class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value="ALL">{{ filterLabel('ALL') }}</option>
            <option value="OVERPOWERED">{{ filterLabel('OVERPOWERED') }}</option>
            <option value="UNDERPOWERED">{{ filterLabel('UNDERPOWERED') }}</option>
            <option value="BALANCED">{{ filterLabel('BALANCED') }}</option>
          </select>
        </label>
        <label class="text-xs text-text/80">
          Average
          <select
            v-model="averageFilter"
            class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value="ALL">{{ filterLabel('ALL') }}</option>
            <option value="OVERPOWERED">{{ filterLabel('OVERPOWERED') }}</option>
            <option value="UNDERPOWERED">{{ filterLabel('UNDERPOWERED') }}</option>
            <option value="BALANCED">{{ filterLabel('BALANCED') }}</option>
          </select>
        </label>
        <label class="text-xs text-text/80">
          Skilled
          <select
            v-model="skilledFilter"
            class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value="ALL">{{ filterLabel('ALL') }}</option>
            <option value="OVERPOWERED">{{ filterLabel('OVERPOWERED') }}</option>
            <option value="UNDERPOWERED">{{ filterLabel('UNDERPOWERED') }}</option>
            <option value="BALANCED">{{ filterLabel('BALANCED') }}</option>
          </select>
        </label>
        <label class="text-xs text-text/80">
          Elite
          <select
            v-model="eliteFilter"
            class="mt-1 w-full rounded border border-primary/30 bg-background px-2 py-1.5 text-sm text-text"
          >
            <option value="ALL">{{ filterLabel('ALL') }}</option>
            <option value="OVERPOWERED">{{ filterLabel('OVERPOWERED') }}</option>
            <option value="UNDERPOWERED">{{ filterLabel('UNDERPOWERED') }}</option>
            <option value="BALANCED">{{ filterLabel('BALANCED') }}</option>
          </select>
        </label>
      </div>

      <div
        v-if="filteredRows.length"
        class="statistics-overview-surface w-full overflow-x-auto rounded-lg border border-primary/30"
      >
        <table class="w-full min-w-[1350px] text-left text-sm">
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
                :title="p.t('statisticsPage.balanceTooltipAverageDelta')"
              >
                Δ Average
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.balanceTooltipSkilled')"
              >
                Skilled
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.balanceTooltipSkilledDelta')"
              >
                Δ Skilled
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.balanceTooltipElite')"
              >
                Elite
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.balanceTooltipEliteDelta')"
              >
                Δ Elite
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.balanceTooltipGlobal')"
              >
                {{ p.t('statisticsPage.balanceGlobalStatus') }}
              </th>
              <th
                class="px-3 py-2 font-semibold text-text"
                :title="p.t('statisticsPage.balanceTooltipGlobalDelta')"
              >
                Δ Global
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20">
            <tr
              v-for="row in filteredRows"
              :key="row.championId"
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
              <td class="px-3 py-2 font-medium" :class="statusClass(row.average.status)">
                <div>{{ statusLabel(row.average.status) }}</div>
                <div class="mt-0.5 text-[11px] font-normal text-text/70">
                  {{ relationToOp(row.average, 'average') }}
                </div>
                <div class="text-[11px] font-normal text-text/70">
                  {{ relationToUp(row.average, 'average') }}
                </div>
              </td>
              <td class="px-3 py-2 text-xs" :class="deltaClass(row.average.delta)">
                {{ row.average.delta || '—' }}
              </td>
              <td class="px-3 py-2 font-medium" :class="statusClass(row.skilled.status)">
                <div>{{ statusLabel(row.skilled.status) }}</div>
                <div class="mt-0.5 text-[11px] font-normal text-text/70">
                  {{ relationToOp(row.skilled, 'skilled') }}
                </div>
                <div class="text-[11px] font-normal text-text/70">
                  {{ relationToUp(row.skilled, 'skilled') }}
                </div>
              </td>
              <td class="px-3 py-2 text-xs" :class="deltaClass(row.skilled.delta)">
                {{ row.skilled.delta || '—' }}
              </td>
              <td class="px-3 py-2 font-medium" :class="statusClass(row.elite.status)">
                <div>{{ statusLabel(row.elite.status) }}</div>
                <div class="mt-0.5 text-[11px] font-normal text-text/70">
                  {{ relationToOp(row.elite, 'elite') }}
                </div>
                <div class="text-[11px] font-normal text-text/70">
                  {{ relationToUp(row.elite, 'elite') }}
                </div>
              </td>
              <td class="px-3 py-2 text-xs" :class="deltaClass(row.elite.delta)">
                {{ row.elite.delta || '—' }}
              </td>
              <td class="px-3 py-2 font-semibold" :class="statusClass(row.globalStatus)">
                {{ statusLabel(row.globalStatus) }}
              </td>
              <td class="px-3 py-2 text-xs" :class="deltaClass(row.globalDelta)">
                {{ row.globalDelta || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-text/70">{{ p.t('statisticsPage.overviewDetailNoData') }}</div>

      <p v-if="previousPatch" class="text-xs text-text/60">
        {{ p.t('statisticsPage.balanceDeltaReference', { patch: previousPatch }) }}
      </p>
    </template>
  </div>
</template>
