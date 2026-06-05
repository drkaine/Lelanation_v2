<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import ChampionMatchupMobileCard, {
  type MatchupsExtDominanceKey,
  type MatchupsExtRow,
  type MatchupsExtSignalLevel,
} from '~/components/statistics/ChampionMatchupMobileCard.vue'
import StatisticsMobileSortBar from '~/components/statistics/StatisticsMobileSortBar.vue'

export type SynergyExtRow = {
  rank: number
  allyChampionId: number
  role: string
  allyRole: string
  games: number
  wins: number
  winrate: number
  winrateDeltaVsReference?: number | null
  synergyScore: number
  synergyScoreDeltaVsReference?: number | null
  pickrate: number
  pickrateDeltaVsReference?: number | null
  delta1?: number
  delta2?: number
  laneScore: number
  laneScoreDeltaVsReference?: number | null
  dominanceKeys: MatchupsExtDominanceKey[]
  weaknessKeys?: MatchupsExtDominanceKey[]
  laneProfileByKey?: Partial<Record<MatchupsExtDominanceKey, MatchupsExtSignalLevel>>
}

const props = defineProps<{
  pending?: boolean
  error?: string | null
  rows: SynergyExtRow[]
  referenceVersion?: string | null
  gameVersion: string
  filterRole: string
  searchQuery: string
  laneProfileFilter: 'ALL' | 'balanced' | MatchupsExtDominanceKey
  otpMode: 'oui' | 'non' | 'solo'
}>()

const { t } = useI18n()
const championsStore = useChampionsStore()

type SynergySortKey =
  | 'rank'
  | 'champion'
  | 'score'
  | 'scoreDelta'
  | 'role'
  | 'allyRole'
  | 'winrate'
  | 'pickrate'
  | 'delta1'
  | 'delta2'
  | 'laneScore'
  | 'dominance'

const sortKey = ref<SynergySortKey>('score')
const sortDir = ref<'asc' | 'desc'>('desc')
const pageSize = ref(20)
const page = ref(1)
const expandedKeys = ref<Set<string>>(new Set())

const ROLE_LABELS: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'ADC',
  SUPPORT: 'Support',
}
const ROLE_ICON_MAP: Record<string, string> = {
  TOP: '/icons/roles/top.png',
  JUNGLE: '/icons/roles/jungle.png',
  MIDDLE: '/icons/roles/mid.png',
  BOTTOM: '/icons/roles/bot.png',
  SUPPORT: '/icons/roles/support.png',
}

function championByKey(id: number) {
  return championsStore.champions.find(c => c.key === String(id)) ?? null
}
function championName(id: number) {
  return championByKey(id)?.name ?? null
}
function roleLabel(role: string) {
  return ROLE_LABELS[role?.toUpperCase()] ?? role
}
function roleIconPath(role: string) {
  return ROLE_ICON_MAP[role?.toUpperCase()] ?? ''
}

function cardKey(row: SynergyExtRow): string {
  return `${row.allyChampionId}-${row.role}-${row.allyRole}`
}

function toMobileRow(row: SynergyExtRow): MatchupsExtRow {
  return {
    rank: row.rank,
    opponentChampionId: row.allyChampionId,
    role: row.allyRole,
    games: row.games,
    wins: row.wins,
    winrate: row.winrate,
    winrateDeltaVsReference: row.winrateDeltaVsReference,
    matchupScore: row.synergyScore,
    matchupScoreDeltaVsReference: row.synergyScoreDeltaVsReference,
    pickrate: row.pickrate,
    pickrateDeltaVsReference: row.pickrateDeltaVsReference,
    delta1: row.delta1,
    delta2: row.delta2,
    laneScore: row.laneScore,
    laneScoreDeltaVsReference: row.laneScoreDeltaVsReference,
    dominanceKeys: row.dominanceKeys,
    weaknessKeys: row.weaknessKeys,
    laneProfileByKey: row.laneProfileByKey,
  }
}

function matchesSearch(allyChampionId: number): boolean {
  const q = props.searchQuery.trim().toLowerCase()
  if (!q) return true
  const name = (championName(allyChampionId) ?? '').toLowerCase()
  return name.includes(q) || String(allyChampionId).toLowerCase().includes(q)
}

function matchesLaneProfile(row: SynergyExtRow): boolean {
  const f = props.laneProfileFilter
  if (f === 'ALL') return true
  if (f === 'balanced') return !row.dominanceKeys?.length && !row.weaknessKeys?.length
  return (row.dominanceKeys?.includes(f) ?? false) || (row.weaknessKeys?.includes(f) ?? false)
}

function matchesOtp(row: SynergyExtRow): boolean {
  if (props.otpMode === 'oui') return true
  if (props.otpMode === 'solo') return Number(row.pickrate ?? 0) <= 1
  return Number(row.pickrate ?? 0) > 1
}

const filteredRows = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.rows]
    .filter(r => matchesSearch(r.allyChampionId) && matchesLaneProfile(r) && matchesOtp(r))
    .sort((a, b) => {
      if (sortKey.value === 'rank') return dir * (a.rank - b.rank)
      if (sortKey.value === 'champion') {
        const an = championName(a.allyChampionId) ?? String(a.allyChampionId)
        const bn = championName(b.allyChampionId) ?? String(b.allyChampionId)
        return dir * an.localeCompare(bn)
      }
      if (sortKey.value === 'score') return dir * (a.synergyScore - b.synergyScore)
      if (sortKey.value === 'scoreDelta') {
        const ad = a.synergyScoreDeltaVsReference ?? Number.NEGATIVE_INFINITY
        const bd = b.synergyScoreDeltaVsReference ?? Number.NEGATIVE_INFINITY
        return dir * (ad - bd)
      }
      if (sortKey.value === 'role') return dir * a.role.localeCompare(b.role)
      if (sortKey.value === 'allyRole') return dir * a.allyRole.localeCompare(b.allyRole)
      if (sortKey.value === 'winrate') return dir * (a.winrate - b.winrate)
      if (sortKey.value === 'pickrate') return dir * (a.pickrate - b.pickrate)
      if (sortKey.value === 'delta1') return dir * ((a.delta1 ?? 0) - (b.delta1 ?? 0))
      if (sortKey.value === 'delta2') return dir * ((a.delta2 ?? 0) - (b.delta2 ?? 0))
      if (sortKey.value === 'laneScore') return dir * (a.laneScore - b.laneScore)
      const ad = (a.dominanceKeys?.length ?? 0) + (a.weaknessKeys?.length ?? 0)
      const bd = (b.dominanceKeys?.length ?? 0) + (b.weaknessKeys?.length ?? 0)
      return dir * (ad - bd)
    })
})

watch([filteredRows, pageSize], () => {
  page.value = 1
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value))
)
const paginatedRows = computed(() => {
  const p = Math.min(page.value, totalPages.value)
  const start = (p - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

function setSort(key: SynergySortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'champion' || key === 'role' || key === 'allyRole' ? 'asc' : 'desc'
}

function sortIcon(key: SynergySortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}

const mobileSortColumn = computed({
  get: () => sortKey.value,
  set: (v: string) => setSort(v as SynergySortKey),
})

const mobileSortOptions = computed(() => {
  const opts = [
    { value: 'rank', label: t('statisticsPage.tierListRank') },
    { value: 'champion', label: t('statisticsPage.championSynergyColAlly') },
    { value: 'score', label: t('statisticsPage.championSynergyColScore') },
    {
      value: 'scoreDelta',
      label: `${t('statisticsPage.championTableDeltaSymbol')} ${t('statisticsPage.championSynergyColScore')}`,
    },
    { value: 'winrate', label: t('statisticsPage.winrate') },
    { value: 'pickrate', label: t('statisticsPage.championSynergyColPickrate') },
    { value: 'delta1', label: t('statisticsPage.championSynergyColDelta1') },
    { value: 'delta2', label: t('statisticsPage.championSynergyColDelta2') },
    { value: 'laneScore', label: t('statisticsPage.championSynergyColLaneScore') },
    { value: 'dominance', label: t('statisticsPage.championSynergyColProfile') },
  ]
  if (!props.filterRole) {
    opts.splice(4, 0, { value: 'role', label: t('statisticsPage.filterRole') })
  }
  opts.splice(5, 0, { value: 'allyRole', label: t('statisticsPage.championSynergyColAllyRole') })
  return opts
})

function formatSignedDelta(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

function deltaClass(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'text-text/55'
  if (v > 0) return 'text-emerald-300'
  if (v < 0) return 'text-rose-300'
  return 'text-text/70'
}

const laneProfileChipBase =
  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] leading-tight tabular-nums'

function laneProfileSignalChipClass(
  level: MatchupsExtSignalLevel,
  side: 'strength' | 'weakness'
): string {
  if (side === 'strength') {
    if (level === 'bigAdvantage') {
      return `${laneProfileChipBase} border-emerald-400/75 bg-emerald-500/35 font-semibold text-emerald-50`
    }
    if (level === 'mediumAdvantage') {
      return `${laneProfileChipBase} border-emerald-500/55 bg-emerald-500/22 text-emerald-100`
    }
    return `${laneProfileChipBase} border-emerald-600/40 bg-emerald-600/12 text-emerald-200`
  }
  if (level === 'bigDisadvantage') {
    return `${laneProfileChipBase} border-rose-400/75 bg-rose-500/35 font-semibold text-rose-50`
  }
  if (level === 'mediumDisadvantage') {
    return `${laneProfileChipBase} border-rose-500/55 bg-rose-500/22 text-rose-100`
  }
  return `${laneProfileChipBase} border-orange-500/45 bg-orange-600/14 text-orange-100`
}

function dominanceTooltip(
  strengths: MatchupsExtDominanceKey[],
  weaknesses?: MatchupsExtDominanceKey[],
  profileByKey?: Partial<Record<MatchupsExtDominanceKey, MatchupsExtSignalLevel>>
): string {
  const lines: string[] = []
  if (strengths?.length) {
    lines.push(t('statisticsPage.championSynergyProfileStrengths'))
    lines.push(
      ...strengths.map(
        k =>
          `+ ${t(`statisticsPage.championMatchupDominance.${k}`)} (${t(`statisticsPage.championMatchupSignalLevel.${profileByKey?.[k] ?? 'smallAdvantage'}`)})`
      )
    )
  }
  if (weaknesses?.length) {
    if (lines.length) lines.push('')
    lines.push(t('statisticsPage.championSynergyProfileWarnings'))
    lines.push(
      ...weaknesses.map(
        k =>
          `- ${t(`statisticsPage.championMatchupDominance.${k}`)} (${t(`statisticsPage.championMatchupSignalLevel.${profileByKey?.[k] ?? 'smallDisadvantage'}`)})`
      )
    )
  }
  if (!lines.length) return t('statisticsPage.championMatchupDominanceBalanced')
  return lines.join('\n')
}

function toggleCard(row: SynergyExtRow) {
  const key = cardKey(row)
  const next = new Set(expandedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedKeys.value = next
}
</script>

<template>
  <div class="champion-synergy-tab">
    <div v-if="pending" class="py-6 text-text/70">{{ t('statisticsPage.loading') }}</div>
    <div v-else-if="error" class="py-2 text-sm text-red-400">{{ error }}</div>
    <div v-else-if="!rows.length" class="py-4 text-text/70">{{ t('statisticsPage.noData') }}</div>
    <div v-else class="space-y-1.5">
      <StatisticsMobileSortBar
        id="champion-synergy-mobile-sort"
        v-model:column="mobileSortColumn"
        v-model:direction="sortDir"
        :options="mobileSortOptions"
        :asc-default-columns="['champion', 'role', 'allyRole']"
      />
      <div
        class="statistics-champion-synergy-mobile-list statistics-tier-list-mobile-list w-full space-y-1 md:hidden"
      >
        <ChampionMatchupMobileCard
          v-for="(row, idx) in paginatedRows"
          :key="cardKey(row)"
          :row="toMobileRow(row)"
          :display-rank="(page - 1) * pageSize + idx + 1"
          :expanded="expandedKeys.has(cardKey(row))"
          :show-role="true"
          :portrait-src="
            gameVersion && championByKey(row.allyChampionId)?.image?.full
              ? getChampionImageUrl(gameVersion, championByKey(row.allyChampionId)!.image!.full)
              : null
          "
          :champion-name="championName(row.allyChampionId) ?? String(row.allyChampionId)"
          :role-label="roleLabel(row.allyRole)"
          :role-icon-src="roleIconPath(row.allyRole)"
          :reference-version="referenceVersion ?? null"
          @toggle="toggleCard(row)"
        />
      </div>
      <div
        class="champion-synergy-table-wrap hidden overflow-x-auto rounded-lg border border-primary/30 bg-surface/30 md:block"
      >
        <table class="tier-list-lolalytics w-full min-w-[1120px] text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-left">
              <th class="px-2 py-2 font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('rank')"
                >
                  {{ t('statisticsPage.tierListRank') }}{{ sortIcon('rank') }}
                </button>
              </th>
              <th class="px-2 py-2 font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('champion')"
                >
                  {{ t('statisticsPage.championSynergyColAlly') }}{{ sortIcon('champion') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('score')"
                >
                  {{ t('statisticsPage.championSynergyColScore') }}{{ sortIcon('score') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('scoreDelta')"
                >
                  {{ t('statisticsPage.championTableDeltaSymbol') }}{{ sortIcon('scoreDelta') }}
                </button>
              </th>
              <th v-if="!filterRole" class="px-2 py-2 text-left font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('role')"
                >
                  {{ t('statisticsPage.filterRole') }}{{ sortIcon('role') }}
                </button>
              </th>
              <th class="px-2 py-2 text-left font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('allyRole')"
                >
                  {{ t('statisticsPage.championSynergyColAllyRole') }}{{ sortIcon('allyRole') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('winrate')"
                >
                  {{ t('statisticsPage.winrate') }}{{ sortIcon('winrate') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('pickrate')"
                >
                  {{ t('statisticsPage.championSynergyColPickrate') }}{{ sortIcon('pickrate') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('delta1')"
                >
                  {{ t('statisticsPage.championSynergyColDelta1') }}{{ sortIcon('delta1') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('delta2')"
                >
                  {{ t('statisticsPage.championSynergyColDelta2') }}{{ sortIcon('delta2') }}
                </button>
              </th>
              <th class="px-2 py-2 text-right font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('laneScore')"
                >
                  {{ t('statisticsPage.championSynergyColLaneScore') }}{{ sortIcon('laneScore') }}
                </button>
              </th>
              <th class="px-2 py-2 font-medium text-text">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 hover:text-accent"
                  @click="setSort('dominance')"
                >
                  {{ t('statisticsPage.championSynergyColProfile') }}{{ sortIcon('dominance') }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in paginatedRows"
              :key="cardKey(row)"
              class="border-b border-primary/15 odd:bg-white/[0.02]"
            >
              <td class="px-2 py-2 tabular-nums text-text/90">
                {{ (page - 1) * pageSize + idx + 1 }}
              </td>
              <td class="px-2 py-2">
                <span class="inline-flex min-w-0 items-center gap-2">
                  <img
                    v-if="gameVersion && championByKey(row.allyChampionId)?.image?.full"
                    :src="
                      getChampionImageUrl(
                        gameVersion,
                        championByKey(row.allyChampionId)!.image!.full
                      )
                    "
                    :alt="championName(row.allyChampionId) ?? ''"
                    class="h-9 w-9 shrink-0 rounded border border-black/40 object-cover"
                    width="36"
                    height="36"
                  />
                  <span class="min-w-0 truncate font-medium text-text/90">{{
                    championName(row.allyChampionId) ?? row.allyChampionId
                  }}</span>
                </span>
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-text/90">
                {{ row.synergyScore.toFixed(2) }}
              </td>
              <td class="px-2 py-2 text-right tabular-nums">
                <span :class="deltaClass(row.synergyScoreDeltaVsReference)">
                  {{ formatSignedDelta(row.synergyScoreDeltaVsReference) }}
                </span>
              </td>
              <td v-if="!filterRole" class="px-2 py-2 text-text/85">
                <span class="inline-flex items-center gap-1">
                  <img
                    v-if="roleIconPath(row.role)"
                    :src="roleIconPath(row.role)"
                    :alt="roleLabel(row.role)"
                    class="h-4 w-4 object-contain"
                    width="16"
                    height="16"
                  />
                  {{ roleLabel(row.role) }}
                </span>
              </td>
              <td class="px-2 py-2 text-text/85">
                <span class="inline-flex items-center gap-1">
                  <img
                    v-if="roleIconPath(row.allyRole)"
                    :src="roleIconPath(row.allyRole)"
                    :alt="roleLabel(row.allyRole)"
                    class="h-4 w-4 object-contain"
                    width="16"
                    height="16"
                  />
                  {{ roleLabel(row.allyRole) }}
                </span>
              </td>
              <td class="px-2 py-2 text-right tabular-nums">
                <div>{{ row.winrate.toFixed(2) }}%</div>
                <div class="text-[11px]" :class="deltaClass(row.winrateDeltaVsReference)">
                  {{ formatSignedDelta(row.winrateDeltaVsReference) }}
                </div>
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-text/85">
                <div>{{ row.pickrate.toFixed(2) }}%</div>
                <div class="text-[11px]" :class="deltaClass(row.pickrateDeltaVsReference)">
                  {{ formatSignedDelta(row.pickrateDeltaVsReference) }}
                </div>
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-text/85">
                <span :class="deltaClass(row.delta1)">{{ formatSignedDelta(row.delta1) }}</span>
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-text/85">
                <span :class="deltaClass(row.delta2)">{{ formatSignedDelta(row.delta2) }}</span>
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-text/85">
                <div>{{ row.laneScore.toFixed(2) }}</div>
                <div class="text-[11px]" :class="deltaClass(row.laneScoreDeltaVsReference)">
                  {{ formatSignedDelta(row.laneScoreDeltaVsReference) }}
                </div>
              </td>
              <td
                class="max-w-md px-2 py-2 align-top"
                :title="dominanceTooltip(row.dominanceKeys, row.weaknessKeys, row.laneProfileByKey)"
              >
                <div v-if="row.dominanceKeys?.length" class="mb-1.5">
                  <div
                    class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400"
                  >
                    {{ t('statisticsPage.championSynergyProfileStrengths') }}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="k in row.dominanceKeys"
                      :key="'dom-' + k"
                      :class="
                        laneProfileSignalChipClass(
                          row.laneProfileByKey?.[k] ?? 'smallAdvantage',
                          'strength'
                        )
                      "
                    >
                      {{ t(`statisticsPage.championMatchupDominanceShort.${k}`) }}
                    </span>
                  </div>
                </div>
                <div v-if="row.weaknessKeys?.length">
                  <div class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                    {{ t('statisticsPage.championSynergyProfileWarnings') }}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="k in row.weaknessKeys"
                      :key="'weak-' + k"
                      :class="
                        laneProfileSignalChipClass(
                          row.laneProfileByKey?.[k] ?? 'smallDisadvantage',
                          'weakness'
                        )
                      "
                    >
                      {{ t(`statisticsPage.championMatchupDominanceShort.${k}`) }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="!row.dominanceKeys?.length && !row.weaknessKeys?.length"
                  class="inline-flex items-center gap-1 rounded border border-primary/25 bg-white/[0.03] px-2 py-1 text-[11px] text-text/65"
                >
                  {{ t('statisticsPage.championMatchupDominanceBalancedShort') }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-text/80">
        <div class="inline-flex items-center gap-2">
          <span>{{ t('statisticsPage.perPage') }}</span>
          <select
            v-model.number="pageSize"
            class="rounded border border-primary/40 bg-background px-1.5 py-0.5 text-xs text-text"
          >
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
        <div class="inline-flex items-center gap-2">
          <button
            type="button"
            class="rounded border border-primary/30 px-2 py-0.5 disabled:opacity-40"
            :disabled="page <= 1"
            @click="page = Math.max(1, page - 1)"
          >
            {{ t('admin.pagination.prev') }}
          </button>
          <span>{{ t('statisticsPage.pageXOfY', { current: page, total: totalPages }) }}</span>
          <button
            type="button"
            class="rounded border border-primary/30 px-2 py-0.5 disabled:opacity-40"
            :disabled="page >= totalPages"
            @click="page = Math.min(totalPages, page + 1)"
          >
            {{ t('admin.pagination.next') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
