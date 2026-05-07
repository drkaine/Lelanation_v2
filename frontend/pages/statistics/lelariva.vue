<template>
  <div class="w-full max-w-none px-4 py-4 text-text">
    <div v-if="!selectedChampionId" class="space-y-4">
      <h1 class="text-xl font-semibold">Lelariva Matchups</h1>
      <div
        class="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <input
          v-model.trim="championSearch"
          type="text"
          class="min-w-[260px] flex-1 rounded border border-primary/40 bg-background px-3 py-2 text-sm"
          :placeholder="t('statisticsPage.championStatsMatchupSearchLabel')"
        />
        <select
          v-model="globalExportVersion"
          class="whitespace-nowrap rounded border border-primary/40 bg-background px-2 py-1 text-xs"
        >
          <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
          <option
            v-for="v in availableVersions"
            :key="'global-version-' + v.version"
            :value="v.version"
          >
            {{ versionOptionLabel(v.version, v.matchCount) }}
          </option>
        </select>
        <select
          v-model="globalExportRole"
          class="whitespace-nowrap rounded border border-primary/40 bg-background px-2 py-1 text-xs"
        >
          <option value="">{{ t('statisticsPage.allRoles') }}</option>
          <option v-for="r in roles" :key="'global-role-' + r.value" :value="r.value">
            {{ r.label }}
          </option>
        </select>
        <select
          v-model="globalExportRank"
          class="whitespace-nowrap rounded border border-primary/40 bg-background px-2 py-1 text-xs"
        >
          <option value="">{{ t('statisticsPage.allRanks') }}</option>
          <option v-for="tier in rankTiers" :key="'global-rank-' + tier" :value="tier">
            {{ tier }}
          </option>
        </select>
        <label class="inline-flex items-center gap-1 text-xs text-text/80">
          <span>{{ t('statisticsPage.exportMinPickrateLabel') }}</span>
          <input
            v-model.number="globalExportMinPickrate"
            type="number"
            min="0"
            step="0.1"
            class="w-24 rounded border border-primary/40 bg-background px-2 py-1 text-xs"
          />
        </label>
        <label class="inline-flex items-center gap-1 text-xs text-text/80">
          <span>{{ t('statisticsPage.exportMinGamesLabel') }}</span>
          <input
            v-model.number="globalExportMinGames"
            type="number"
            min="0"
            step="1"
            class="w-24 rounded border border-primary/40 bg-background px-2 py-1 text-xs"
          />
        </label>
        <button
          type="button"
          class="whitespace-nowrap rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          @click="
            globalExportRankMode = globalExportRankMode === 'cumulative' ? 'separate' : 'cumulative'
          "
        >
          Rank {{ globalExportRankMode === 'cumulative' ? 'cumulé' : 'séparé' }}
        </button>
        <button
          type="button"
          class="whitespace-nowrap rounded border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="exportingAll"
          @click="exportAllChampionsExcel"
        >
          {{ exportingAll ? 'Export all…' : 'Export all champions (Excel)' }}
        </button>
      </div>
      <div class="flex flex-wrap items-start gap-0">
        <button
          v-for="c in filteredChampions"
          :key="c.key"
          type="button"
          class="flex items-center justify-center p-0 leading-none transition hover:opacity-85"
          @click="selectChampion(Number(c.key))"
        >
          <img
            v-if="gameVersion && c.image?.full"
            :src="getChampionImageUrl(gameVersion, c.image.full)"
            :alt="c.name"
            class="block h-10 w-10 rounded object-cover"
          />
        </button>
      </div>
    </div>

    <div v-else class="space-y-4">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-surface/30 px-3 py-2 text-sm"
        @click="clearChampion"
      >
        <img
          v-if="selectedChampion && gameVersion && selectedChampion.image?.full"
          :src="getChampionImageUrl(gameVersion, selectedChampion.image.full)"
          :alt="selectedChampion.name"
          class="h-8 w-8 rounded border border-black/40 object-cover"
        />
        <span class="font-semibold">{{ selectedChampion?.name }}</span>
      </button>

      <div
        class="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <select
          v-model="filterVersion"
          class="rounded border border-primary/40 bg-background px-2 py-1 text-xs"
        >
          <option value="">{{ t('statisticsPage.overviewVersionAll') }}</option>
          <option v-for="v in availableVersions" :key="'version-' + v.version" :value="v.version">
            {{ versionOptionLabel(v.version, v.matchCount) }}
          </option>
        </select>
        <select
          v-model="filterRole"
          class="rounded border border-primary/40 bg-background px-2 py-1 text-xs"
        >
          <option value="">{{ t('statisticsPage.allRoles') }}</option>
          <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
        <select
          v-model="filterRank"
          class="rounded border border-primary/40 bg-background px-2 py-1 text-xs"
        >
          <option value="">{{ t('statisticsPage.allRanks') }}</option>
          <option v-for="tier in rankTiers" :key="tier" :value="tier">{{ tier }}</option>
        </select>
        <div class="ml-auto flex flex-nowrap items-center gap-2">
          <select
            v-model="exportRole"
            class="rounded border border-primary/40 bg-background px-2 py-1 text-xs"
            :title="'Export role filter'"
          >
            <option value="">{{ t('statisticsPage.allRoles') }}</option>
            <option v-for="r in roles" :key="'exp-role-' + r.value" :value="r.value">
              {{ r.label }}
            </option>
          </select>
          <select
            v-model="exportRank"
            class="rounded border border-primary/40 bg-background px-2 py-1 text-xs"
            :title="'Export division filter'"
          >
            <option value="">{{ t('statisticsPage.allRanks') }}</option>
            <option v-for="tier in rankTiers" :key="'exp-rank-' + tier" :value="tier">
              {{ tier }}
            </option>
          </select>
          <label class="inline-flex items-center gap-1 text-xs text-text/80">
            <span>{{ t('statisticsPage.exportMinPickrateLabel') }}</span>
            <input
              v-model.number="exportMinPickrate"
              type="number"
              min="0"
              step="0.1"
              class="w-24 rounded border border-primary/40 bg-background px-2 py-1 text-xs"
            />
          </label>
          <label class="inline-flex items-center gap-1 text-xs text-text/80">
            <span>{{ t('statisticsPage.exportMinGamesLabel') }}</span>
            <input
              v-model.number="exportMinGames"
              type="number"
              min="0"
              step="1"
              class="w-24 rounded border border-primary/40 bg-background px-2 py-1 text-xs"
            />
          </label>
          <button
            type="button"
            class="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            @click="exportRankMode = exportRankMode === 'cumulative' ? 'separate' : 'cumulative'"
          >
            Rank {{ exportRankMode === 'cumulative' ? 'cumulé' : 'séparé' }}
          </button>
          <button
            type="button"
            class="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="exporting || !selectedChampionId"
            @click="exportMatchupsExcel"
          >
            {{ exporting ? 'Export…' : 'Export Excel' }}
          </button>
        </div>
      </div>

      <div class="rounded-lg border border-primary/30 bg-surface/30 p-4">
        <div v-if="pending" class="py-8 text-sm text-text/70">
          {{ t('statisticsPage.loading') }}
        </div>
        <div v-else-if="error" class="py-4 text-sm text-red-400">{{ error }}</div>
        <div v-else-if="!rows.length" class="py-4 text-sm text-text/70">
          {{ t('statisticsPage.noData') }}
        </div>
        <div v-else class="overflow-x-auto">
          <table class="tier-list-lolalytics w-full min-w-[1120px] text-sm">
            <thead>
              <tr class="border-b border-primary/30 text-left">
                <th class="px-2 py-2 font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('rank')">
                    #{{ sortIcon('rank') }}
                  </button>
                </th>
                <th class="px-2 py-2 font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('champion')">
                    {{ t('statisticsPage.champion') }}{{ sortIcon('champion') }}
                  </button>
                </th>
                <th class="px-2 py-2 text-right font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('score')">
                    {{ t('statisticsPage.championMatchupColScore') }}{{ sortIcon('score') }}
                  </button>
                </th>
                <th class="px-2 py-2 text-right font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('winrate')">
                    {{ t('statisticsPage.winrate') }}{{ sortIcon('winrate') }}
                  </button>
                </th>
                <th class="px-2 py-2 text-right font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('pickrate')">
                    {{ t('statisticsPage.championMatchupColPickrate') }}{{ sortIcon('pickrate') }}
                  </button>
                </th>
                <th class="px-2 py-2 text-right font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('delta1')">
                    {{ t('statisticsPage.championMatchupColDelta1') }}{{ sortIcon('delta1') }}
                  </button>
                </th>
                <th class="px-2 py-2 text-right font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('delta2')">
                    {{ t('statisticsPage.championMatchupColDelta2') }}{{ sortIcon('delta2') }}
                  </button>
                </th>
                <th class="px-2 py-2 text-right font-medium">
                  <button type="button" class="hover:text-accent" @click="setSort('laneScore')">
                    {{ t('statisticsPage.championMatchupColLaneScore') }}{{ sortIcon('laneScore') }}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in sortedRows"
                :key="`${row.opponentChampionId}-${row.role}`"
                class="border-b border-primary/15 odd:bg-white/[0.02]"
              >
                <td class="px-2 py-2">{{ idx + 1 }}</td>
                <td class="px-2 py-2">
                  <div class="inline-flex items-center gap-2">
                    <img
                      v-if="gameVersion && championByKey(row.opponentChampionId)?.image?.full"
                      :src="
                        getChampionImageUrl(
                          gameVersion,
                          championByKey(row.opponentChampionId)!.image!.full
                        )
                      "
                      :alt="championByKey(row.opponentChampionId)?.name ?? ''"
                      class="h-8 w-8 rounded border border-black/40 object-cover"
                    />
                    <span>{{
                      championByKey(row.opponentChampionId)?.name ?? row.opponentChampionId
                    }}</span>
                  </div>
                </td>
                <td class="px-2 py-2 text-right tabular-nums">{{ row.matchupScore.toFixed(2) }}</td>
                <td class="px-2 py-2 text-right tabular-nums">{{ row.winrate.toFixed(2) }}%</td>
                <td class="px-2 py-2 text-right tabular-nums">{{ row.pickrate.toFixed(2) }}%</td>
                <td class="px-2 py-2 text-right tabular-nums" :class="deltaClass(row.delta1)">
                  {{ formatSigned(row.delta1) }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums" :class="deltaClass(row.delta2)">
                  {{ formatSigned(row.delta2) }}
                </td>
                <td class="px-2 py-2 text-right tabular-nums">{{ row.laneScore.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { apiUrl } from '~/utils/apiUrl'

definePageMeta({ layout: 'default' })

type Row = {
  opponentChampionId: number
  role: string
  matchupScore: number
  winrate: number
  pickrate: number
  delta1?: number
  delta2?: number
  laneScore: number
}

const { locale, t } = useI18n()
const championsStore = useChampionsStore()
const versionStore = useVersionStore()
const gameVersion = computed(() => versionStore.currentVersion ?? null)

const selectedChampionId = ref<number | null>(null)
const championSearch = ref('')
const filterVersion = ref('')
const filterRole = ref('')
const filterRank = ref('')
const pending = ref(false)
const exporting = ref(false)
const exportingAll = ref(false)
const error = ref<string | null>(null)
const rows = ref<Row[]>([])
const availableVersions = ref<Array<{ version: string; matchCount: number }>>([])
const exportRole = ref('')
const exportRank = ref('')
const globalExportVersion = ref('')
const globalExportRole = ref('')
const globalExportRank = ref('')
const exportMinPickrate = ref<number>(0)
const exportMinGames = ref<number>(0)
const globalExportMinPickrate = ref<number>(0)
const globalExportMinGames = ref<number>(0)
const exportRankMode = ref<'cumulative' | 'separate'>('cumulative')
const globalExportRankMode = ref<'cumulative' | 'separate'>('cumulative')
type SortKey =
  | 'rank'
  | 'champion'
  | 'score'
  | 'winrate'
  | 'pickrate'
  | 'delta1'
  | 'delta2'
  | 'laneScore'
const sortKey = ref<SortKey>('score')
const sortDir = ref<'asc' | 'desc'>('desc')

const rankTiers = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER+']
const roles = [
  { value: 'TOP', label: 'Top' },
  { value: 'JUNGLE', label: 'Jungle' },
  { value: 'MIDDLE', label: 'Mid' },
  { value: 'BOTTOM', label: 'ADC' },
  { value: 'SUPPORT', label: 'Support' },
]

const filteredChampions = computed(() => {
  const q = championSearch.value.trim().toLowerCase()
  const all = championsStore.champions
  if (!q) return all
  return all.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
})

const selectedChampion = computed(
  () => championsStore.champions.find(c => Number(c.key) === selectedChampionId.value) ?? null
)
const sortedRows = computed(() => {
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...rows.value].sort((a, b) => {
    if (sortKey.value === 'rank') return dir * (a.matchupScore - b.matchupScore)
    if (sortKey.value === 'champion') {
      const an = (
        championByKey(a.opponentChampionId)?.name ?? String(a.opponentChampionId)
      ).toLowerCase()
      const bn = (
        championByKey(b.opponentChampionId)?.name ?? String(b.opponentChampionId)
      ).toLowerCase()
      return dir * an.localeCompare(bn)
    }
    if (sortKey.value === 'score') return dir * (a.matchupScore - b.matchupScore)
    if (sortKey.value === 'winrate') return dir * (a.winrate - b.winrate)
    if (sortKey.value === 'pickrate') return dir * (a.pickrate - b.pickrate)
    if (sortKey.value === 'delta1') return dir * ((a.delta1 ?? -999) - (b.delta1 ?? -999))
    if (sortKey.value === 'delta2') return dir * ((a.delta2 ?? -999) - (b.delta2 ?? -999))
    return dir * (a.laneScore - b.laneScore)
  })
})

function championByKey(id: number) {
  return championsStore.champions.find(c => Number(c.key) === id) ?? null
}
function selectChampion(id: number) {
  selectedChampionId.value = id
}
function clearChampion() {
  selectedChampionId.value = null
  rows.value = []
  error.value = null
}
function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = key
  sortDir.value = key === 'champion' ? 'asc' : 'desc'
}
function sortIcon(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ↑' : ' ↓'
}
function formatSigned(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}
function deltaClass(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'text-text/60'
  if (v > 0.05) return 'text-emerald-300'
  if (v < -0.05) return 'text-rose-300'
  return 'text-text/70'
}

type ExportPayload = {
  columns: string[]
  rows: Array<Record<string, number | string | null>>
}

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return `"${s.replace(/"/g, '""')}"`
}

function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(';')
}
function versionOptionLabel(version: string, matchCount: number): string {
  const count = Number(matchCount ?? 0)
  return `${version} - ${Number.isFinite(count) ? count : 0} games`
}
function toSafeMinNumber(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

async function fetchExportRowsForChampion(
  championId: number,
  version: string,
  role: string,
  rankTier: string
): Promise<ExportPayload> {
  const params = new URLSearchParams()
  if (version) params.set('version', version)
  if (role) params.set('role', role)
  if (rankTier) params.set('rankTier', rankTier)
  const q = params.toString()
  return await $fetch<ExportPayload>(
    apiUrl(`/api/stats/champions/${championId}/matchups-export-rows${q ? `?${q}` : ''}`)
  )
}

async function exportMatchupsExcel() {
  if (!selectedChampionId.value) return
  exporting.value = true
  try {
    const ranksToExport = exportRankMode.value === 'separate' ? [...rankTiers] : [exportRank.value]
    let data: ExportPayload | null = null
    const exportRows: Array<Record<string, number | string | null>> = []
    for (const rank of ranksToExport) {
      const d = await fetchExportRowsForChampion(
        selectedChampionId.value,
        filterVersion.value,
        exportRole.value,
        rank
      )
      if (!data) data = d
      exportRows.push(...(d.rows ?? []))
    }
    const minPick = toSafeMinNumber(exportMinPickrate.value)
    const minGames = toSafeMinNumber(exportMinGames.value)
    const filteredRows = exportRows.filter(r => {
      const pick = Number(r.pickrate ?? 0)
      const games = Number(r.count_game ?? 0)
      return pick >= minPick && games >= minGames
    })
    const champName = selectedChampion.value?.name ?? String(selectedChampionId.value)
    const header = ['champion_name', 'opponent_name', ...((data?.columns ?? []) as string[])]
    const lines: string[] = []
    lines.push('sep=;')
    lines.push(csvLine(header))
    for (const r of filteredRows) {
      const rowOut: Array<string | number | null> = [
        champName,
        championByKey(Number(r.opponent_champion_id ?? 0))?.name ??
          String(r.opponent_champion_id ?? ''),
      ]
      for (const c of data?.columns ?? []) rowOut.push((r[c] as string | number | null) ?? '')
      lines.push(csvLine(rowOut))
    }
    const content = `\uFEFF${lines.join('\n')}`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lelariva_matchups_${champName}_${exportRole.value || 'ALL'}_${exportRank.value || 'ALL'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } finally {
    exporting.value = false
  }
}

async function exportAllChampionsExcel() {
  exportingAll.value = true
  try {
    const allChampions = championsStore.champions
    const lines: string[] = []
    let header: string[] | null = null
    const minPick = toSafeMinNumber(globalExportMinPickrate.value)
    const minGames = toSafeMinNumber(globalExportMinGames.value)

    for (const champ of allChampions) {
      const cid = Number(champ.key)
      if (!Number.isFinite(cid) || cid <= 0) continue
      const ranksToExport =
        globalExportRankMode.value === 'separate' ? [...rankTiers] : [globalExportRank.value]
      for (const rank of ranksToExport) {
        const data = await fetchExportRowsForChampion(
          cid,
          globalExportVersion.value,
          globalExportRole.value,
          rank
        )
        const champRows = data?.rows ?? []
        if (!header) {
          header = ['champion_name', 'opponent_name', ...(data?.columns ?? [])]
          lines.push('sep=;')
          lines.push(csvLine(header))
        }
        for (const r of champRows) {
          const pick = Number(r.pickrate ?? 0)
          const games = Number(r.count_game ?? 0)
          if (pick < minPick || games < minGames) continue
          const rowOut: Array<string | number | null> = [
            champ.name,
            championByKey(Number(r.opponent_champion_id ?? 0))?.name ??
              String(r.opponent_champion_id ?? ''),
          ]
          for (const c of data.columns ?? []) rowOut.push((r[c] as string | number | null) ?? '')
          lines.push(csvLine(rowOut))
        }
      }
    }

    if (!header) {
      lines.push('sep=;')
      lines.push(csvLine(['champion_name', 'opponent_name']))
    }
    const content = `\uFEFF${lines.join('\n')}`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lelariva_matchups_ALL_${globalExportRole.value || 'ALL'}_${globalExportRank.value || 'ALL'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } finally {
    exportingAll.value = false
  }
}

async function loadMatchups() {
  if (!selectedChampionId.value) return
  pending.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (filterVersion.value) params.set('version', filterVersion.value)
    if (filterRole.value) params.set('role', filterRole.value)
    if (filterRank.value) params.set('rankTier', filterRank.value)
    const q = params.toString()
    const data = await $fetch<{ rows: Row[] }>(
      apiUrl(
        `/api/stats/champions/${selectedChampionId.value}/matchups-extended${q ? `?${q}` : ''}`
      )
    )
    rows.value = data?.rows ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load matchups'
    rows.value = []
  } finally {
    pending.value = false
  }
}

onMounted(async () => {
  if (!versionStore.currentVersion) await versionStore.loadCurrentVersion()
  if (championsStore.champions.length === 0) {
    await championsStore.loadChampions(locale.value === 'fr' ? 'fr_FR' : 'en_US')
  }
  try {
    const data = await $fetch<Record<string, unknown>>(apiUrl('/api/stats/overview'))
    const list = (data?.matchesByVersion ?? data?.matches_by_version ?? []) as Array<{
      version?: string
      matchCount?: number
    }>
    availableVersions.value = Array.isArray(list)
      ? list
          .map(v => ({
            version: String(v.version ?? '').trim(),
            matchCount: Number(v.matchCount ?? 0),
          }))
          .filter(v => v.version)
      : []
  } catch {
    availableVersions.value = []
  }
  if (availableVersions.value.length === 0) {
    try {
      const versionsData = await $fetch<{
        versions?: Array<{ version?: string; patchLabel?: string }>
      }>(apiUrl('/api/game-data/versions'))
      const vals = (versionsData?.versions ?? [])
        .map(v => String(v.version ?? v.patchLabel ?? '').trim())
        .filter(Boolean)
      availableVersions.value = Array.from(new Set(vals)).map(version => ({
        version,
        matchCount: 0,
      }))
    } catch {
      availableVersions.value = gameVersion.value
        ? [{ version: gameVersion.value, matchCount: 0 }]
        : []
    }
  }
  if (availableVersions.value.length === 0 && gameVersion.value) {
    availableVersions.value = [{ version: gameVersion.value, matchCount: 0 }]
  }
  try {
    const versionsData = await $fetch<{
      versions?: Array<{ version?: string; patchLabel?: string }>
    }>(apiUrl('/api/game-data/versions'))
    const vals = (versionsData?.versions ?? [])
      .map(v => String(v.version ?? v.patchLabel ?? '').trim())
      .filter(Boolean)
    const existing = new Set(availableVersions.value.map(v => v.version))
    for (const version of vals) {
      if (!existing.has(version)) availableVersions.value.push({ version, matchCount: 0 })
    }
  } catch {
    // no-op
  }
  filterVersion.value = gameVersion.value ?? ''
  globalExportVersion.value = gameVersion.value ?? ''
})

watch([selectedChampionId, filterVersion, filterRole, filterRank], () => {
  loadMatchups().catch(() => {
    // handled in loadMatchups via error state
  })
})
</script>
