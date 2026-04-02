<script setup lang="ts">
/**
 * Onglet Runes (stats globales) : grille type arbre + fragments, pick/WR/ban (N/A) et deltas patch.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRunesStore } from '~/stores/RunesStore'
import { getRuneImageUrl, getRunePathColor, getSpellImageUrl } from '~/utils/imageUrl'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'

type RuneStat = { pickrate: number; winrate: number; games: number }
type DetailPayload = {
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  shards?: Array<{
    shardId: number
    slot: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  summonerSpells: Array<{
    spellId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
}

const props = defineProps<{
  gameVersion: string
  data: DetailPayload | null
  baseline: DetailPayload | null
  baselinePending: boolean
  comparisonVersion: string | null
}>()

const { t } = useI18n()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()

const SHARD_ICONS: Record<number, string> = {
  5008: '/icons/shards/adaptative.png',
  5005: '/icons/shards/speed.png',
  5006: '/icons/shards/move.png',
  5007: '/icons/shards/cdr.png',
  5001: '/icons/shards/hp.png',
  5002: '/icons/shards/growth.png',
  5003: '/icons/shards/tenacity.png',
}

/** Lignes de fragments (slot Riot 0 = offense, 1 = flex, 2 = défense). */
const SHARD_ROWS: Array<{ slot: number; ids: number[] }> = [
  { slot: 0, ids: [5008, 5005, 5007] },
  { slot: 1, ids: [5008, 5006, 5002] },
  { slot: 2, ids: [5001, 5003, 5002] },
]

function getShardIcon(shardId: number): string {
  return SHARD_ICONS[shardId] ?? SHARD_ICONS[5008]!
}

function shardName(shardId: number): string {
  return t(`runes.shards.${shardId}.name`, String(shardId))
}

const runeMap = computed(() => {
  const m: Record<number, RuneStat> = {}
  for (const r of props.data?.runes ?? []) {
    m[r.runeId] = { pickrate: r.pickrate, winrate: r.winrate, games: r.games }
  }
  return m
})

const baselineRuneMap = computed(() => {
  const m: Record<number, RuneStat> = {}
  for (const r of props.baseline?.runes ?? []) {
    m[r.runeId] = { pickrate: r.pickrate, winrate: r.winrate, games: r.games }
  }
  return m
})

function shardStat(shardId: number, slot: number): RuneStat | null {
  const row = props.data?.shards?.find(s => s.shardId === shardId && s.slot === slot)
  if (!row) return null
  return { pickrate: row.pickrate, winrate: row.winrate, games: row.games }
}

function baselineShardStat(shardId: number, slot: number): RuneStat | null {
  const row = props.baseline?.shards?.find(s => s.shardId === shardId && s.slot === slot)
  if (!row) return null
  return { pickrate: row.pickrate, winrate: row.winrate, games: row.games }
}

const pathsWithCells = computed(() => {
  const stats = runeMap.value
  return runesStore.runePaths.map(path => {
    const cells: Array<{
      row: number
      col: number
      rune: { id: number; name: string; icon: string }
      stats: RuneStat | null
    }> = []
    path.slots.forEach((slot, slotIndex) => {
      const numCols = slotIndex === 0 ? 4 : 3
      slot.runes.slice(0, numCols).forEach((rune, runeIndex) => {
        cells.push({
          row: slotIndex,
          col: runeIndex,
          rune: { id: rune.id, name: rune.name, icon: rune.icon },
          stats: stats[rune.id] ?? null,
        })
      })
    })
    return { path, cells }
  })
})

/** Max pickrate par ligne (row) dans chaque arbre → surbrillance « meta ». */
function isTopPickInPathRow(
  pathId: number,
  row: number,
  runeId: number,
  st: RuneStat | null
): boolean {
  if (!st || st.games <= 0) return false
  const group =
    pathsWithCells.value.find(p => p.path.id === pathId)?.cells.filter(c => c.row === row) ?? []
  let max = -1
  for (const c of group) {
    const s = c.stats
    if (s && s.pickrate > max) max = s.pickrate
  }
  return max >= 0 && st.pickrate >= max - 0.0001
}

function wrClass(wr: number): string {
  if (wr >= 52) return 'text-sky-300'
  if (wr <= 48) return 'text-red-400/90'
  return 'text-text/80'
}

function formatDelta(cur: number, old: number | undefined): string {
  if (old === undefined || !Number.isFinite(old)) return '—'
  const d = Math.round((cur - old) * 10) / 10
  if (d === 0) return '0'
  return (d > 0 ? '+' : '') + d.toFixed(1)
}

function deltaClass(cur: number, old: number | undefined): string {
  if (old === undefined || !Number.isFinite(old)) return 'text-text/40'
  const d = cur - old
  if (d > 0.05) return 'text-sky-400/90'
  if (d < -0.05) return 'text-red-400/80'
  return 'text-text/55'
}

const runeSetsHighlights = computed(() => {
  const sets = props.data?.runeSets ?? []
  const minG = 80
  const valid = sets.filter(s => s.games >= minG)
  if (valid.length === 0) {
    return {
      topPick: [] as typeof sets,
      lowPick: [] as typeof sets,
      bestWr: [] as typeof sets,
      worstWr: [] as typeof sets,
    }
  }
  return {
    topPick: [...valid].sort((a, b) => b.pickrate - a.pickrate).slice(0, 3),
    lowPick: [...valid].sort((a, b) => a.pickrate - b.pickrate).slice(0, 3),
    bestWr: [...valid].sort((a, b) => b.winrate - a.winrate).slice(0, 3),
    worstWr: [...valid].sort((a, b) => a.winrate - b.winrate).slice(0, 3),
  }
})

function runeIdsFromSet(runesUnknown: unknown): number[] {
  if (runesUnknown == null || typeof runesUnknown !== 'object') return []
  const perks = runesUnknown as { styles?: Array<{ selections?: Array<{ perk?: number }> }> }
  const styles = perks?.styles
  if (!Array.isArray(styles)) return []
  const ids: number[] = []
  for (const style of styles) {
    const selections = style?.selections
    if (!Array.isArray(selections)) continue
    for (const sel of selections) {
      if (typeof sel?.perk === 'number') ids.push(sel.perk)
    }
  }
  return ids
}

function getRuneById(runeId: number): { id: number; name: string; icon: string } | null {
  for (const path of runesStore.runePaths) {
    for (const slot of path.slots) {
      const rune = slot.runes.find(r => r.id === runeId)
      if (rune) return rune
    }
  }
  return null
}

function runePathPanelStyle(path: {
  icon: string
  id: number
  name: string
}): Record<string, string> {
  const color = getRunePathColor(path.icon, path.id, path.name)
  return {
    borderColor: `${color}66`,
    boxShadow: `inset 0 0 0 1px ${color}22`,
  }
}

function isTopShardPick(slot: number, shardId: number): boolean {
  const row = SHARD_ROWS.find(r => r.slot === slot)
  if (!row) return false
  const peers = row.ids
    .map(id => shardStat(id, slot))
    .filter((s): s is RuneStat => s != null && s.games > 0)
  if (!peers.length) return false
  const maxP = Math.max(...peers.map(p => p.pickrate))
  const st = shardStat(shardId, slot)
  return !!st && st.pickrate >= maxP - 0.01
}

function shardImgClass(slot: number, shardId: number): string {
  return isTopShardPick(slot, shardId)
    ? 'border-amber-400/55 opacity-100 grayscale-0'
    : 'opacity-40 grayscale'
}

function spellName(spellId: number): string | null {
  return summonerSpellsStore.getSpellById(String(spellId))?.name ?? null
}

function spellImageName(spellId: number): string | null {
  return summonerSpellsStore.getSpellById(String(spellId))?.image?.full ?? null
}
</script>

<template>
  <div class="stats-runes-panel flex w-full flex-col gap-8">
    <!-- Grille runes + fragments -->
    <div class="rounded-lg border border-primary/15 bg-purple-500/[0.06] px-4 py-6 sm:px-8 sm:py-8">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm font-bold uppercase tracking-wide text-text/90">{{
          t('statisticsPage.tabRunes')
        }}</span>
        <span v-if="comparisonVersion" class="text-xs text-text/55">
          {{ t('statisticsPage.runesDeltaVs', { version: comparisonVersion }) }}
          <span v-if="baselinePending" class="ml-1 text-text/40"
            >({{ t('statisticsPage.loading') }})</span
          >
        </span>
      </div>

      <div class="flex flex-col gap-10">
        <div
          class="stats-runes-paths-grid grid min-w-0 gap-x-4 gap-y-8 overflow-x-auto pb-2 lg:gap-x-6"
          style="grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr))"
        >
          <div
            v-for="{ path, cells } in pathsWithCells"
            v-show="cells.length > 0"
            :key="path.id"
            class="stats-runes-path flex min-w-[9.5rem] flex-col gap-2"
            :style="runePathPanelStyle(path)"
          >
            <div
              v-for="rowIdx in 4"
              :key="path.id + '-r' + (rowIdx - 1)"
              class="flex flex-wrap justify-center gap-2"
            >
              <template v-for="cell in cells.filter(c => c.row === rowIdx - 1)" :key="cell.rune.id">
                <div
                  v-if="cell.stats"
                  class="flex min-w-[2rem] flex-col items-center gap-1"
                  :title="
                    cell.rune.name +
                    ' — ' +
                    Number(cell.stats.pickrate).toFixed(2) +
                    '% pick, ' +
                    Number(cell.stats.winrate).toFixed(2) +
                    '% WR'
                  "
                >
                  <img
                    :src="getRuneImageUrl(gameVersion, cell.rune.icon)"
                    :alt="cell.rune.name"
                    width="24"
                    height="24"
                    class="h-6 w-6 rounded-full border object-contain"
                    :class="
                      isTopPickInPathRow(path.id, cell.row, cell.rune.id, cell.stats)
                        ? 'border-amber-400/60 bg-black/50 opacity-100 grayscale-0'
                        : 'border-primary/25 bg-black/60 opacity-50 grayscale'
                    "
                  />
                  <span
                    class="text-[11px] font-bold tabular-nums leading-none"
                    :class="[
                      wrClass(cell.stats.winrate),
                      !isTopPickInPathRow(path.id, cell.row, cell.rune.id, cell.stats)
                        ? 'opacity-60'
                        : '',
                    ]"
                    >{{ Number(cell.stats.winrate).toFixed(1) }}</span
                  >
                  <span
                    class="text-[10px] tabular-nums leading-none text-text/50"
                    :class="
                      !isTopPickInPathRow(path.id, cell.row, cell.rune.id, cell.stats)
                        ? 'opacity-50'
                        : ''
                    "
                    >{{ Number(cell.stats.pickrate).toFixed(1) }}</span
                  >
                  <span class="text-[9px] tabular-nums text-text/35">—</span>
                  <template v-if="comparisonVersion && !baselinePending">
                    <span
                      class="text-[9px] tabular-nums"
                      :class="
                        deltaClass(cell.stats.pickrate, baselineRuneMap[cell.rune.id]?.pickrate)
                      "
                    >
                      ΔP
                      {{
                        formatDelta(cell.stats.pickrate, baselineRuneMap[cell.rune.id]?.pickrate)
                      }}
                    </span>
                    <span
                      class="text-[9px] tabular-nums"
                      :class="
                        deltaClass(cell.stats.winrate, baselineRuneMap[cell.rune.id]?.winrate)
                      "
                    >
                      ΔWR
                      {{ formatDelta(cell.stats.winrate, baselineRuneMap[cell.rune.id]?.winrate) }}
                    </span>
                  </template>
                </div>
                <div v-else class="flex min-w-[2rem] flex-col items-center gap-1 opacity-30">
                  <img
                    :src="getRuneImageUrl(gameVersion, cell.rune.icon)"
                    :alt="cell.rune.name"
                    width="24"
                    height="24"
                    class="h-6 w-6 rounded-full border border-primary/20 bg-black/70 object-contain grayscale"
                  />
                  <span class="text-[10px] text-text/40">—</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Fragments -->
        <div>
          <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-text/70">
            {{ t('runes.stat-selection') }}
          </h3>
          <div class="flex flex-col gap-4">
            <div
              v-for="row in SHARD_ROWS"
              :key="'shard-row-' + row.slot"
              class="flex flex-wrap justify-center gap-6 sm:gap-10"
            >
              <div
                v-for="sid in row.ids"
                :key="row.slot + '-' + sid"
                class="flex min-w-[2.5rem] flex-col items-center gap-1"
              >
                <img
                  :src="getShardIcon(sid)"
                  :alt="shardName(sid)"
                  width="32"
                  height="32"
                  class="h-8 w-8 rounded-full border border-primary/25 bg-black/70 object-contain p-0.5"
                  :class="shardImgClass(row.slot, sid)"
                />
                <template v-if="shardStat(sid, row.slot)">
                  <span
                    class="text-[11px] font-bold tabular-nums"
                    :class="wrClass(shardStat(sid, row.slot)!.winrate)"
                    >{{ Number(shardStat(sid, row.slot)!.winrate).toFixed(1) }}</span
                  >
                  <span class="text-[10px] tabular-nums text-text/50">{{
                    Number(shardStat(sid, row.slot)!.pickrate).toFixed(1)
                  }}</span>
                  <span class="text-[9px] text-text/35">—</span>
                  <template v-if="comparisonVersion && !baselinePending">
                    <span
                      class="text-[9px] tabular-nums"
                      :class="
                        deltaClass(
                          shardStat(sid, row.slot)!.pickrate,
                          baselineShardStat(sid, row.slot)?.pickrate
                        )
                      "
                    >
                      ΔP
                      {{
                        formatDelta(
                          shardStat(sid, row.slot)!.pickrate,
                          baselineShardStat(sid, row.slot)?.pickrate
                        )
                      }}
                    </span>
                    <span
                      class="text-[9px] tabular-nums"
                      :class="
                        deltaClass(
                          shardStat(sid, row.slot)!.winrate,
                          baselineShardStat(sid, row.slot)?.winrate
                        )
                      "
                    >
                      ΔWR
                      {{
                        formatDelta(
                          shardStat(sid, row.slot)!.winrate,
                          baselineShardStat(sid, row.slot)?.winrate
                        )
                      }}
                    </span>
                  </template>
                </template>
                <span v-else class="text-[10px] text-text/40">—</span>
              </div>
            </div>
          </div>
        </div>
        <p class="text-[11px] leading-snug text-text/45">
          {{ t('statisticsPage.runesBanNote') }}
        </p>
      </div>
    </div>

    <!-- Sorts -->
    <div class="rounded-lg border border-primary/20 bg-surface/25 px-4 py-4 sm:px-6">
      <h3 class="mb-3 text-sm font-semibold text-text">
        {{ t('statisticsPage.overviewDetailSummonerSpells') }}
      </h3>
      <div class="flex flex-wrap items-center gap-3">
        <div
          v-for="s in data?.summonerSpells ?? []"
          :key="s.spellId"
          class="flex items-center gap-2 rounded border border-primary/20 bg-black/30 px-3 py-2 text-xs"
        >
          <img
            v-if="spellImageName(s.spellId)"
            :src="getSpellImageUrl(gameVersion, spellImageName(s.spellId)!)"
            :alt="spellName(s.spellId) ?? ''"
            class="h-6 w-6 object-contain"
            width="24"
            height="24"
          />
          <span class="font-medium text-text/90">{{ spellName(s.spellId) ?? s.spellId }}</span>
          <span class="text-text/65"
            >{{ Number(s.pickrate).toFixed(2) }}% · {{ Number(s.winrate).toFixed(2) }}% WR</span
          >
        </div>
      </div>
    </div>

    <!-- Sets : plus / moins pick, meilleur / pire WR -->
    <div class="rounded-lg border border-primary/20 bg-surface/20 px-4 py-6 sm:px-6">
      <h3 class="mb-4 text-sm font-semibold text-text">
        {{ t('statisticsPage.overviewDetailRuneSets') }}
      </h3>
      <div class="grid gap-6 lg:grid-cols-2">
        <div
          v-for="block in [
            {
              key: 'topPick',
              title: t('statisticsPage.runeSetsMostPicked'),
              list: runeSetsHighlights.topPick,
            },
            {
              key: 'lowPick',
              title: t('statisticsPage.runeSetsLeastPicked'),
              list: runeSetsHighlights.lowPick,
            },
            {
              key: 'bestWr',
              title: t('statisticsPage.runeSetsBestWr'),
              list: runeSetsHighlights.bestWr,
            },
            {
              key: 'worstWr',
              title: t('statisticsPage.runeSetsWorstWr'),
              list: runeSetsHighlights.worstWr,
            },
          ]"
          :key="block.key"
          class="min-w-0"
        >
          <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-accent/90">
            {{ block.title }}
          </h4>
          <div class="flex flex-col gap-2">
            <div
              v-for="(set, idx) in block.list"
              :key="block.key + '-' + idx"
              class="rune-set-row flex items-center gap-2 rounded border border-primary/20 bg-surface/40 px-2 py-1.5"
            >
              <div class="flex min-w-[3rem] flex-col items-center gap-0.5 text-center">
                <div class="h-1 w-full max-w-[2.5rem] overflow-hidden rounded-full bg-primary/25">
                  <div
                    class="h-full rounded-full bg-accent"
                    :style="{ width: Math.min(100, set.pickrate) + '%' }"
                  />
                </div>
                <span class="text-[10px] font-semibold tabular-nums text-text"
                  >{{ Number(set.winrate).toFixed(1) }}%</span
                >
                <span class="text-[9px] text-text/55">{{ Number(set.pickrate).toFixed(2) }}%</span>
              </div>
              <div class="flex flex-1 flex-wrap gap-0.5">
                <div
                  v-for="runeId in runeIdsFromSet(set.runes)"
                  :key="runeId"
                  class="rune-set-rune flex h-[22px] w-[22px] items-center justify-center rounded"
                  :title="getRuneById(runeId)?.name ?? ''"
                >
                  <div
                    v-if="getRuneById(runeId)"
                    class="h-[22px] w-[22px] rounded bg-primary/15 bg-contain bg-center bg-no-repeat"
                    :style="{
                      backgroundImage: `url(${getRuneImageUrl(gameVersion, getRuneById(runeId)!.icon)})`,
                    }"
                  />
                </div>
              </div>
            </div>
            <p v-if="!block.list.length" class="text-xs text-text/50">
              {{ t('statisticsPage.overviewNoData') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-runes-paths-grid {
  scrollbar-gutter: stable;
}
.rune-set-row {
  min-height: 2.75rem;
}
</style>
