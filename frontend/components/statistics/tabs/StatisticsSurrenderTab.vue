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
  if (value == null || !Number.isFinite(value)) return ''
  const sign = value > 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(2)}%`
}

function formatStatCount(value: number): string {
  return Math.round(Number(value))
    .toLocaleString('fr-FR')
    .replace(/\u202F/g, '')
}

function deltaClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'text-text/60'
  if (value === 0) return 'text-text/60'
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
  surrenderCount: number
  earlySurrenderCount: number
  surrenderRate: number
  earlySurrenderRate: number
  surrenderDelta: number | null
  earlySurrenderDelta: number | null
}

function surrenderOnlyCount(row: Row | null | undefined): number {
  if (!row) return 0
  return Math.max(0, Number(row.surrenderCount ?? 0) - Number(row.earlySurrenderCount ?? 0))
}

function playedCount(row: Row | null | undefined): number {
  if (!row) return 0
  return Math.max(0, Number(row.matchCount ?? 0) - Number(row.surrenderCount ?? 0))
}

function rowHasData(row: Row | null | undefined): boolean {
  return !!row && Number(row.matchCount) > 0
}

function groupHasData(group: { all: Row | null; blue: Row | null; red: Row | null }): boolean {
  return rowHasData(group.all) || rowHasData(group.blue) || rowHasData(group.red)
}

function outcomePct(part: number, total: number): string {
  if (!total || total <= 0) return '0.00'
  return ((part / total) * 100).toFixed(2)
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
    'UNRANKED',
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
    .filter(groupHasData)
})

function rankIcon(rank: string): string {
  if (rank === 'ALL') return '/data/community-dragon/ranked-emblem/Unranked.png'
  return p.getRankedEmblemUrl(rank) || '/data/community-dragon/ranked-emblem/Unranked.png'
}
</script>

<template>
  <div class="statistics-surrender-tab space-y-3">
    <div class="statistics-surrender-panel w-full max-w-full">
      <div v-if="p.surrenderMatrixPending" class="text-sm text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div v-else-if="groupedRows.length === 0" class="text-sm text-text/70">
        {{ p.t('statisticsPage.noData') }}
      </div>
      <div v-else class="w-full min-w-0">
        <!-- Mobile : une carte « Répartition des parties » par division -->
        <div class="statistics-surrender-mobile-list space-y-3 md:hidden">
          <article
            v-for="group in groupedRows"
            :key="`surrender-mobile-${group.rank}`"
            class="statistics-surrender-mobile-card w-full max-w-full py-2"
          >
            <button
              type="button"
              class="statistics-surrender-mobile-card-header mb-2 flex w-full items-center gap-2.5 text-left"
              @click="toggleRank(group.rank)"
            >
              <span
                class="inline-block shrink-0 text-xs text-text/60 transition-transform duration-200"
                :class="openRanks.has(group.rank) ? 'rotate-180' : ''"
                aria-hidden
                >▼</span
              >
              <img
                :src="rankIcon(group.rank)"
                :alt="rankLabel(group.rank)"
                class="statistics-surrender-mobile-rank-icon h-8 w-8 shrink-0 object-contain"
                loading="lazy"
              />
              <h3
                class="statistics-surrender-mobile-rank-title min-w-0 flex-1 text-base font-semibold leading-snug text-amber-300"
              >
                {{ rankLabel(group.rank) }}
              </h3>
              <span
                v-if="group.all?.matchCount"
                class="statistics-surrender-mobile-match-count shrink-0 text-[10px] tabular-nums leading-tight text-text/60"
              >
                {{ Number(group.all.matchCount).toLocaleString() }}
                <span class="statistics-surrender-mobile-match-count-label">
                  {{ p.t('statisticsPage.overviewDurationWinrateTooltipMatches') }}
                </span>
              </span>
            </button>

            <div
              v-if="group.all && Number(group.all.matchCount) > 0"
              class="statistics-surrender-mobile-card-body flex flex-col items-center gap-3 pt-3"
            >
              <StatisticsMatchOutcomeDonut
                :total="Number(group.all.matchCount)"
                :early="Number(group.all.earlySurrenderCount)"
                :surrender-only="surrenderOnlyCount(group.all)"
                :played="playedCount(group.all)"
              />
              <div class="statistics-surrender-mobile-details w-full min-w-0 space-y-1.5">
                <div class="statistics-surrender-details-title font-medium text-text/90">
                  {{ p.t('statisticsPage.overviewMatchOutcomesTitle') }}
                </div>
                <div class="statistics-surrender-stat-block">
                  <span class="statistics-surrender-stat-label">
                    <span class="statistics-surrender-stat-dot bg-amber-300" />
                    <span>{{ p.t('statisticsPage.surrenderStatEarlyShort') }}</span>
                  </span>
                  <span class="statistics-surrender-stat-value">
                    {{ formatStatCount(Number(group.all.earlySurrenderCount)) }}
                    <span class="text-text/55"
                      >({{
                        outcomePct(
                          Number(group.all.earlySurrenderCount),
                          Number(group.all.matchCount)
                        )
                      }}%)</span
                    >
                    <span
                      v-if="delta(group.all.earlySurrenderDelta)"
                      class="statistics-surrender-stat-delta"
                      :class="deltaClass(group.all.earlySurrenderDelta)"
                    >
                      {{ delta(group.all.earlySurrenderDelta) }}
                    </span>
                  </span>
                </div>
                <div class="statistics-surrender-stat-block">
                  <span class="statistics-surrender-stat-label">
                    <span class="statistics-surrender-stat-dot bg-amber-100" />
                    <span>{{ p.t('statisticsPage.surrenderStatSurrenderShort') }}</span>
                  </span>
                  <span class="statistics-surrender-stat-value">
                    {{ formatStatCount(surrenderOnlyCount(group.all)) }}
                    <span class="text-text/55"
                      >({{
                        outcomePct(surrenderOnlyCount(group.all), Number(group.all.matchCount))
                      }}%)</span
                    >
                    <span
                      v-if="delta(group.all.surrenderDelta)"
                      class="statistics-surrender-stat-delta"
                      :class="deltaClass(group.all.surrenderDelta)"
                    >
                      {{ delta(group.all.surrenderDelta) }}
                    </span>
                  </span>
                </div>
                <div class="statistics-surrender-stat-block">
                  <span class="statistics-surrender-stat-label">
                    <span class="statistics-surrender-stat-dot bg-blue-400" />
                    <span>{{ p.t('statisticsPage.surrenderPlayedMatches') }}</span>
                  </span>
                  <span class="statistics-surrender-stat-value">
                    {{ formatStatCount(playedCount(group.all)) }}
                    <span class="text-text/55"
                      >({{
                        outcomePct(playedCount(group.all), Number(group.all.matchCount))
                      }}%)</span
                    >
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="py-3 text-center text-xs text-text/60">
              {{ p.t('statisticsPage.noData') }}
            </div>

            <div
              v-if="openRanks.has(group.rank) && (group.blue || group.red)"
              class="statistics-surrender-mobile-side-block mt-3 space-y-3 pt-3"
            >
              <div
                v-if="group.blue && Number(group.blue.matchCount) > 0"
                class="statistics-surrender-mobile-side-card rounded-lg bg-sky-500/5 p-2"
              >
                <div class="mb-2 text-xs font-semibold text-sky-300">{{ teamLabel(100) }}</div>
                <div class="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                  <StatisticsMatchOutcomeDonut
                    side-accent="blue"
                    :total="Number(group.blue.matchCount)"
                    :early="Number(group.blue.earlySurrenderCount)"
                    :surrender-only="surrenderOnlyCount(group.blue)"
                    :played="playedCount(group.blue)"
                  />
                  <div class="w-full min-w-0 space-y-1.5">
                    <div class="statistics-surrender-stat-block">
                      <span class="statistics-surrender-stat-label">
                        {{ p.t('statisticsPage.surrenderStatSurrenderShort') }}
                      </span>
                      <span class="statistics-surrender-stat-value">
                        {{ pct(group.blue.surrenderRate) }}
                        <span
                          v-if="delta(group.blue.surrenderDelta)"
                          class="statistics-surrender-stat-delta"
                          :class="deltaClass(group.blue.surrenderDelta)"
                        >
                          {{ delta(group.blue.surrenderDelta) }}
                        </span>
                      </span>
                    </div>
                    <div class="statistics-surrender-stat-block">
                      <span class="statistics-surrender-stat-label">
                        {{ p.t('statisticsPage.surrenderStatEarlyShort') }}
                      </span>
                      <span class="statistics-surrender-stat-value">
                        {{ pct(group.blue.earlySurrenderRate) }}
                        <span
                          v-if="delta(group.blue.earlySurrenderDelta)"
                          class="statistics-surrender-stat-delta"
                          :class="deltaClass(group.blue.earlySurrenderDelta)"
                        >
                          {{ delta(group.blue.earlySurrenderDelta) }}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="group.red && Number(group.red.matchCount) > 0"
                class="statistics-surrender-mobile-side-card rounded-lg bg-rose-500/5 p-2"
              >
                <div class="mb-2 text-xs font-semibold text-rose-300">{{ teamLabel(200) }}</div>
                <div class="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                  <StatisticsMatchOutcomeDonut
                    side-accent="red"
                    :total="Number(group.red.matchCount)"
                    :early="Number(group.red.earlySurrenderCount)"
                    :surrender-only="surrenderOnlyCount(group.red)"
                    :played="playedCount(group.red)"
                  />
                  <div class="w-full min-w-0 space-y-1.5">
                    <div class="statistics-surrender-stat-block">
                      <span class="statistics-surrender-stat-label">
                        {{ p.t('statisticsPage.surrenderStatSurrenderShort') }}
                      </span>
                      <span class="statistics-surrender-stat-value">
                        {{ pct(group.red.surrenderRate) }}
                        <span
                          v-if="delta(group.red.surrenderDelta)"
                          class="statistics-surrender-stat-delta"
                          :class="deltaClass(group.red.surrenderDelta)"
                        >
                          {{ delta(group.red.surrenderDelta) }}
                        </span>
                      </span>
                    </div>
                    <div class="statistics-surrender-stat-block">
                      <span class="statistics-surrender-stat-label">
                        {{ p.t('statisticsPage.surrenderStatEarlyShort') }}
                      </span>
                      <span class="statistics-surrender-stat-value">
                        {{ pct(group.red.earlySurrenderRate) }}
                        <span
                          v-if="delta(group.red.earlySurrenderDelta)"
                          class="statistics-surrender-stat-delta"
                          :class="deltaClass(group.red.earlySurrenderDelta)"
                        >
                          {{ delta(group.red.earlySurrenderDelta) }}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <!-- Desktop : tableau -->
        <div class="hidden w-full min-w-0 overflow-x-auto md:block">
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
                    <span
                      v-if="delta(group.all?.surrenderDelta)"
                      :class="deltaClass(group.all?.surrenderDelta)"
                    >
                      {{ delta(group.all?.surrenderDelta) }}
                    </span>
                  </td>
                  <td class="px-1 py-1.5 text-center tabular-nums">
                    {{ pct(group.all?.earlySurrenderRate) }}
                    <span
                      v-if="delta(group.all?.earlySurrenderDelta)"
                      :class="deltaClass(group.all?.earlySurrenderDelta)"
                    >
                      {{ delta(group.all?.earlySurrenderDelta) }}
                    </span>
                  </td>
                </tr>
                <template v-if="openRanks.has(group.rank)">
                  <tr v-if="group.blue" class="bg-surface/30">
                    <td class="py-1 pl-8 pr-2 text-text/75">{{ teamLabel(100) }}</td>
                    <td class="px-1 py-1 text-center tabular-nums text-text/80">
                      {{ pct(group.blue.surrenderRate) }}
                      <span
                        v-if="delta(group.blue.surrenderDelta)"
                        :class="deltaClass(group.blue.surrenderDelta)"
                      >
                        {{ delta(group.blue.surrenderDelta) }}
                      </span>
                    </td>
                    <td class="px-1 py-1 text-center tabular-nums text-text/80">
                      {{ pct(group.blue.earlySurrenderRate) }}
                      <span
                        v-if="delta(group.blue.earlySurrenderDelta)"
                        :class="deltaClass(group.blue.earlySurrenderDelta)"
                      >
                        {{ delta(group.blue.earlySurrenderDelta) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="group.red" class="bg-surface/30">
                    <td class="py-1 pl-8 pr-2 text-text/75">{{ teamLabel(200) }}</td>
                    <td class="px-1 py-1 text-center tabular-nums text-text/80">
                      {{ pct(group.red.surrenderRate) }}
                      <span
                        v-if="delta(group.red.surrenderDelta)"
                        :class="deltaClass(group.red.surrenderDelta)"
                      >
                        {{ delta(group.red.surrenderDelta) }}
                      </span>
                    </td>
                    <td class="px-1 py-1 text-center tabular-nums text-text/80">
                      {{ pct(group.red.earlySurrenderRate) }}
                      <span
                        v-if="delta(group.red.earlySurrenderDelta)"
                        :class="deltaClass(group.red.earlySurrenderDelta)"
                      >
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
  </div>
</template>

<style scoped>
.objectives-zebra-cols th:nth-child(even),
.objectives-zebra-cols td:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.04);
}

.statistics-surrender-panel,
.statistics-surrender-mobile-list {
  width: 100%;
  max-width: 100%;
}

.statistics-surrender-mobile-details {
  font-size: 10px;
  line-height: 1.3;
}

.statistics-surrender-details-title {
  font-size: 10px;
}

.statistics-surrender-stat-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.statistics-surrender-stat-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: rgb(var(--rgb-text) / 0.72);
  font-size: 9px;
  font-weight: 600;
  line-height: 1.2;
}

.statistics-surrender-stat-dot {
  display: inline-block;
  height: 0.4rem;
  width: 0.4rem;
  flex-shrink: 0;
  border-radius: 9999px;
}

.statistics-surrender-stat-value {
  display: block;
  padding-left: 0.7rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: rgb(var(--rgb-text) / 0.92);
}

.statistics-surrender-stat-delta {
  margin-left: 0.2rem;
  font-size: 9px;
}

@media (max-width: 768px) {
  .statistics-surrender-tab {
    margin-inline: -1rem;
    width: calc(100% + 2rem);
    max-width: 100vw;
  }

  .statistics-surrender-mobile-card {
    width: 100%;
    padding-left: 0;
    padding-right: 0;
  }

  .statistics-surrender-mobile-list {
    gap: 1rem;
  }

  .statistics-surrender-mobile-side-block {
    border-top: none;
  }
}
</style>
