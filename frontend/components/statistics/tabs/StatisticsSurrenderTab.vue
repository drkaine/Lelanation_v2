<script setup lang="ts">
import { computed, inject, ref } from 'vue'

const p = inject('statisticsPageCtx') as any

function teamLabel(team: 'ALL' | 100 | 200): string {
  if (team === 100) return p.t('statisticsPage.sidesBlue')
  if (team === 200) return p.t('statisticsPage.sidesRed')
  return p.t('statisticsPage.allRanks')
}

function rankLabel(rank: string): string {
  if (rank === 'ALL') return p.t('statisticsPage.allRanks')
  return p.formatDivisionLabel(rank)
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Number(value).toFixed(2)}%`
}

function delta(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '(—)'
  const sign = value > 0 ? '+' : ''
  return `(${sign}${Number(value).toFixed(2)} %)`
}

function deltaClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return 'text-text/60'
  return value > 0 ? 'text-rose-400' : 'text-emerald-400'
}

const rows = computed(() => p.surrenderMatrixRows ?? [])

const openRanks = ref(new Set<string>())
function toggleRank(rank: string) {
  if (openRanks.value.has(rank)) openRanks.value.delete(rank)
  else openRanks.value.add(rank)
}

type Row = {
  rankTier: string
  team: 'ALL' | 100 | 200
  matchCount: number
  surrenderRate: number
  earlySurrenderRate: number
  surrenderDelta: number | null
  earlySurrenderDelta: number | null
}

const groupedRows = computed(() => {
  const byRank = new Map<string, { all: Row | null; blue: Row | null; red: Row | null }>()
  for (const row of rows.value as Row[]) {
    const rank = String(row.rankTier ?? 'ALL').toUpperCase()
    const slot = byRank.get(rank) ?? { all: null, blue: null, red: null }
    if (row.team === 'ALL') slot.all = row
    else if (row.team === 100) slot.blue = row
    else if (row.team === 200) slot.red = row
    byRank.set(rank, slot)
  }
  const order = [
    'ALL',
    'IRON',
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'EMERALD',
    'DIAMOND',
    'MASTER',
    'GRANDMASTER',
    'CHALLENGER',
  ]
  return order
    .map(rank => ({ rank, ...(byRank.get(rank) ?? { all: null, blue: null, red: null }) }))
    .filter(g => g.all || g.blue || g.red)
})

function rankIcon(rank: string): string {
  if (rank === 'ALL') return '/data/community-dragon/ranked-emblem/Unranked.png'
  return p.getRankedEmblemUrl(rank) || '/data/community-dragon/ranked-emblem/Unranked.png'
}
</script>

<template>
  <div class="space-y-3">
    <div
      class="fast-stat-card fast-stat-card-objectives w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
    >
      <div v-if="p.surrenderMatrixPending" class="text-sm text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div v-else-if="groupedRows.length === 0" class="text-sm text-text/70">
        {{ p.t('statisticsPage.noData') }}
      </div>
      <div v-else class="w-full min-w-0 overflow-x-auto">
        <table class="objectives-zebra-cols w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewMatchesByDivision') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.abandonsSurrenderRate') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.abandonsEarlySurrenderRate') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/85">
            <template v-for="group in groupedRows" :key="`rank-${group.rank}`">
              <tr>
                <td class="py-1.5 pr-2">
                  <button
                    type="button"
                    class="flex items-center gap-2 font-medium text-text/90 hover:text-text"
                    @click="toggleRank(group.rank)"
                  >
                    <span
                      class="inline-block transition-transform duration-200"
                      :class="openRanks.has(group.rank) ? 'rotate-180' : ''"
                      aria-hidden
                      >▼</span
                    >
                    <img
                      :src="rankIcon(group.rank)"
                      :alt="rankLabel(group.rank)"
                      class="h-4 w-4 object-contain"
                      loading="lazy"
                    />
                    <span>{{ rankLabel(group.rank) }}</span>
                  </button>
                </td>
                <td class="px-1 py-1.5 text-center tabular-nums">
                  {{ pct(group.all?.surrenderRate) }}
                  <span :class="deltaClass(group.all?.surrenderDelta)">
                    {{ delta(group.all?.surrenderDelta) }}
                  </span>
                </td>
                <td class="px-1 py-1.5 text-center tabular-nums">
                  {{ pct(group.all?.earlySurrenderRate) }}
                  <span :class="deltaClass(group.all?.earlySurrenderDelta)">
                    {{ delta(group.all?.earlySurrenderDelta) }}
                  </span>
                </td>
              </tr>
              <template v-if="openRanks.has(group.rank)">
                <tr v-if="group.blue" class="bg-surface/30">
                  <td class="py-1 pl-8 pr-2 text-text/75">{{ teamLabel(100) }}</td>
                  <td class="px-1 py-1 text-center tabular-nums text-text/80">
                    {{ pct(group.blue.surrenderRate) }}
                    <span :class="deltaClass(group.blue.surrenderDelta)">
                      {{ delta(group.blue.surrenderDelta) }}
                    </span>
                  </td>
                  <td class="px-1 py-1 text-center tabular-nums text-text/80">
                    {{ pct(group.blue.earlySurrenderRate) }}
                    <span :class="deltaClass(group.blue.earlySurrenderDelta)">
                      {{ delta(group.blue.earlySurrenderDelta) }}
                    </span>
                  </td>
                </tr>
                <tr v-if="group.red" class="bg-surface/30">
                  <td class="py-1 pl-8 pr-2 text-text/75">{{ teamLabel(200) }}</td>
                  <td class="px-1 py-1 text-center tabular-nums text-text/80">
                    {{ pct(group.red.surrenderRate) }}
                    <span :class="deltaClass(group.red.surrenderDelta)">
                      {{ delta(group.red.surrenderDelta) }}
                    </span>
                  </td>
                  <td class="px-1 py-1 text-center tabular-nums text-text/80">
                    {{ pct(group.red.earlySurrenderRate) }}
                    <span :class="deltaClass(group.red.earlySurrenderDelta)">
                      {{ delta(group.red.earlySurrenderDelta) }}
                    </span>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
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
