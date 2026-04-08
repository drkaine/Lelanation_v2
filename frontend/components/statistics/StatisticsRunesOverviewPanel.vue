<script setup lang="ts">
/**
 * Onglet Runes (stats globales) : grille type arbre + fragments, pick / WR, deltas vs patch de comparaison.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RunePath } from '@lelanation/shared-types'
import { useRunesStore } from '~/stores/RunesStore'
import { getRuneImageUrl, getRunePathColor, getRunePathImageUrl } from '~/utils/imageUrl'

type RuneStat = { pickrate: number; winrate: number; games: number }
type DetailPayload = {
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    shards?: number[]
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

const SHARD_ICONS: Record<number, string> = {
  5008: '/icons/shards/adaptative.png',
  5005: '/icons/shards/speed.png',
  5006: '/icons/shards/move.png',
  5010: '/icons/shards/move.png',
  5007: '/icons/shards/cdr.png',
  5001: '/icons/shards/growth.png',
  5002: '/icons/shards/growth.png',
  5011: '/icons/shards/hp.png',
  5003: '/icons/shards/tenacity.png',
  5013: '/icons/shards/tenacity.png',
}

/** Lignes de fragments (slot Riot 0 = offense, 1 = flex, 2 = défense). IDs courants Riot (StatMods). */
const SHARD_ROWS: Array<{ slot: number; ids: number[] }> = [
  { slot: 0, ids: [5008, 5005, 5007] },
  { slot: 1, ids: [5008, 5010, 5001] },
  { slot: 2, ids: [5011, 5013, 5001] },
]

/** Anciens perk IDs encore présents dans des réponses / matchs archivés. */
const SHARD_LEGACY_ALIASES = new Map<string, number[]>([
  ['5010:1', [5010, 5006]],
  ['5001:1', [5001, 5002]],
  ['5013:2', [5013, 5003]],
  ['5001:2', [5001, 5002]],
  ['5011:2', [5011]],
])

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

function shardIdsForStat(shardId: number, slot: number): number[] {
  return SHARD_LEGACY_ALIASES.get(`${shardId}:${slot}`) ?? [shardId]
}

function mergedShardStat(
  payload: DetailPayload | null | undefined,
  shardId: number,
  slot: number
): RuneStat | null {
  const ids = shardIdsForStat(shardId, slot)
  const rows = payload?.shards
  if (!rows?.length) return null
  let games = 0
  let wins = 0
  for (const sid of ids) {
    const row = rows.find(s => s.shardId === sid && s.slot === slot)
    if (row) {
      games += row.games
      wins += row.wins
    }
  }
  if (games <= 0) return null
  const tp = payload?.totalParticipants ?? 0
  return {
    games,
    winrate: Math.round((wins / games) * 10000) / 100,
    pickrate: tp > 0 ? Math.round((games / tp) * 10000) / 100 : 0,
  }
}

function shardStat(shardId: number, slot: number): RuneStat | null {
  return mergedShardStat(props.data, shardId, slot)
}

function baselineShardStat(shardId: number, slot: number): RuneStat | null {
  return mergedShardStat(props.baseline, shardId, slot)
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
    topPick: [...valid].sort((a, b) => b.pickrate - a.pickrate).slice(0, 5),
    lowPick: [...valid].sort((a, b) => a.pickrate - b.pickrate).slice(0, 5),
    bestWr: [...valid].sort((a, b) => b.winrate - a.winrate).slice(0, 5),
    worstWr: [...valid].sort((a, b) => a.winrate - b.winrate).slice(0, 5),
  }
})

function getRuneById(runeId: number): { id: number; name: string; icon: string } | null {
  for (const path of runesStore.runePaths) {
    for (const slot of path.slots) {
      const rune = slot.runes.find(r => r.id === runeId)
      if (rune) return rune
    }
  }
  return null
}

function runeTreeMeta(perkId: number): {
  path: RunePath
  slot: number
  idx: number
  pathId: number
} | null {
  for (const path of runesStore.runePaths) {
    for (let s = 0; s < path.slots.length; s++) {
      const idx = path.slots[s]!.runes.findIndex(r => r.id === perkId)
      if (idx >= 0) return { path, slot: s, idx, pathId: path.id }
    }
  }
  return null
}

function isShardStatId(id: number): boolean {
  return id >= 5000 && id < 6000
}

/**
 * DB: JSON `[id,…]`, chaîne `"8112-0,8124-0,…"` (perk–style), ou objet Riot `styles[]`.
 */
function parseRuneSetParts(run: unknown): { style0: number[]; style1: number[]; shards: number[] } {
  const style0: number[] = []
  const style1: number[] = []
  const shards: number[] = []

  const push = (perkId: number, styleIdx: number) => {
    if (!Number.isFinite(perkId)) return
    if (isShardStatId(perkId)) {
      if (!shards.includes(perkId)) shards.push(perkId)
      return
    }
    const bucket = styleIdx <= 0 ? style0 : style1
    if (!bucket.includes(perkId)) bucket.push(perkId)
  }

  if (run == null) return { style0, style1, shards }

  if (typeof run === 'string') {
    const trimmed = run.trim()
    if (!trimmed) return { style0, style1, shards }
    if (trimmed.startsWith('[')) {
      try {
        const arr = JSON.parse(trimmed) as unknown
        if (Array.isArray(arr)) {
          for (const x of arr) push(Number(x), 0)
        }
      } catch {
        /* chaîne type liste */
      }
      if (style0.length || style1.length || shards.length) return { style0, style1, shards }
    }
    for (const part of trimmed.split(',')) {
      const p = part.trim()
      if (!p) continue
      const [idStr, styStr] = p.split('-')
      const perkId = Number(idStr)
      const styleIdx = styStr !== undefined && styStr !== '' ? Number(styStr) : 0
      push(perkId, Number.isFinite(styleIdx) ? styleIdx : 0)
    }
    return { style0, style1, shards }
  }

  if (Array.isArray(run)) {
    for (const x of run) push(Number(x), 0)
    return { style0, style1, shards }
  }

  if (typeof run === 'object' && 'styles' in (run as object)) {
    const styles = (run as { styles?: { selections?: { perk?: number }[] }[] }).styles
    if (Array.isArray(styles)) {
      styles.forEach((st, idx) => {
        const selections = st?.selections
        if (!Array.isArray(selections)) return
        for (const sel of selections) {
          const perk = sel?.perk
          if (typeof perk === 'number') push(perk, idx)
        }
      })
    }
    return { style0, style1, shards }
  }

  return { style0, style1, shards }
}

function sortPerkIdsByTree(ids: number[]): number[] {
  return [...ids].sort((a, b) => {
    const ma = runeTreeMeta(a)
    const mb = runeTreeMeta(b)
    if (!ma && !mb) return a - b
    if (!ma) return 1
    if (!mb) return -1
    if (ma.pathId !== mb.pathId) return ma.pathId - mb.pathId
    if (ma.slot !== mb.slot) return ma.slot - mb.slot
    return ma.idx - mb.idx
  })
}

function sortShardIdsForSet(ids: number[]): number[] {
  const order = new Map<number, number>()
  SHARD_ROWS.forEach((row, ri) => {
    row.ids.forEach((id, ii) => order.set(id, ri * 10 + ii))
  })
  return [...ids].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
}

type RuneSetRow = NonNullable<DetailPayload['runeSets']>[number]

/** Clé perks+shards (ordre shards normalisé) — match exact si le baseline expose les mêmes fragments. */
function runeSetStableKey(set: Pick<RuneSetRow, 'runes' | 'shards'>): string {
  const { style0, style1, shards: fromRunes } = parseRuneSetParts(set.runes)
  const perkIds = [...new Set([...style0, ...style1])]
    .filter(id => !isShardStatId(id))
    .sort((a, b) => a - b)
  const apiShards = set.shards?.filter(n => Number.isFinite(n) && n > 0) ?? []
  const shardIds =
    apiShards.length > 0
      ? [...new Set(apiShards)].sort((a, b) => a - b)
      : [...new Set(fromRunes)].sort((a, b) => a - b)
  return `${perkIds.join(',')}|${shardIds.join(',')}`
}

/** Clé runes seules — fallback delta si le patch de comparaison n’a pas les shards ou un agrégat différent. */
function runeSetPerkKey(run: unknown): string {
  const { style0, style1 } = parseRuneSetParts(run)
  return [...new Set([...style0, ...style1])]
    .filter(id => !isShardStatId(id))
    .sort((a, b) => a - b)
    .join(',')
}

const baselineRuneSetStatByKey = computed(() => {
  const m = new Map<string, { pickrate: number; winrate: number }>()
  for (const s of props.baseline?.runeSets ?? []) {
    m.set(runeSetStableKey(s), { pickrate: s.pickrate, winrate: s.winrate })
  }
  return m
})

/** Pour un même arbre de runes, plusieurs lignes baseline (shards différents) : garder la plus représentative. */
const baselineRuneSetStatByPerkKey = computed(() => {
  const m = new Map<string, { pickrate: number; winrate: number; games: number }>()
  for (const s of props.baseline?.runeSets ?? []) {
    const k = runeSetPerkKey(s.runes)
    const games = Number(s.games ?? 0)
    const prev = m.get(k)
    if (!prev || games > prev.games) {
      m.set(k, { pickrate: s.pickrate, winrate: s.winrate, games })
    }
  }
  return m
})

function baselineStatsForRuneSet(
  set: RuneSetRow
): { pickrate: number; winrate: number } | undefined {
  const exact = baselineRuneSetStatByKey.value.get(runeSetStableKey(set))
  if (exact) return exact
  const fb = baselineRuneSetStatByPerkKey.value.get(runeSetPerkKey(set.runes))
  return fb ? { pickrate: fb.pickrate, winrate: fb.winrate } : undefined
}

function runeSetLayout(
  run: unknown,
  shardIdsFromApi?: number[] | null
): {
  keystone: number | null
  primaryRow: number[]
  secondaryPath: RunePath | null
  secondaryRunes: number[]
  shards: number[]
} {
  const { style0, style1, shards: rawFromRunes } = parseRuneSetParts(run)
  const api = shardIdsFromApi?.filter(n => Number.isFinite(n) && n > 0) ?? []
  const rawShards = api.length > 0 ? api : rawFromRunes
  const shards = sortShardIdsForSet(rawShards)

  /** Toutes les perks non-shard (JSON `[…]` met souvent les 6 runes en « style 0 » seulement). */
  const allPerkIds = [...new Set([...style0, ...style1])].filter(id => !isShardStatId(id))

  const byPath = new Map<number, number[]>()
  for (const id of allPerkIds) {
    const m = runeTreeMeta(id)
    if (!m) continue
    if (!byPath.has(m.pathId)) byPath.set(m.pathId, [])
    const arr = byPath.get(m.pathId)!
    if (!arr.includes(id)) arr.push(id)
  }
  for (const [pathId, ids] of byPath) {
    byPath.set(pathId, sortPerkIdsByTree(ids))
  }

  const pathEntries = [...byPath.entries()].sort((a, b) => {
    const lenDiff = b[1].length - a[1].length
    if (lenDiff !== 0) return lenDiff
    return a[0] - b[0]
  })

  const primaryIds: number[] = pathEntries[0]?.[1] ?? []
  const secondaryIds: number[] = pathEntries[1]?.[1] ?? []

  const pSorted = sortPerkIdsByTree(primaryIds)
  const keystone = pSorted.find(id => runeTreeMeta(id)?.slot === 0) ?? pSorted[0] ?? null
  const primaryRow = pSorted
    .filter(
      id =>
        id !== keystone &&
        (runeTreeMeta(id)?.slot ?? 99) >= 1 &&
        (runeTreeMeta(id)?.slot ?? 99) <= 3
    )
    .slice(0, 3)
  const fill = pSorted.filter(id => id !== keystone && !primaryRow.includes(id))
  while (primaryRow.length < 3 && fill.length > 0) {
    const next = fill.shift()
    if (next != null) primaryRow.push(next)
  }

  const secondaryRunes = sortPerkIdsByTree(secondaryIds).slice(0, 2)
  const secPath =
    secondaryRunes.length > 0 ? (runeTreeMeta(secondaryRunes[0]!)?.path ?? null) : null

  return {
    keystone,
    primaryRow,
    secondaryPath: secPath,
    secondaryRunes,
    shards,
  }
}
</script>

<template>
  <div class="stats-runes-panel flex w-full flex-col gap-8">
    <!-- Grille runes + fragments -->
    <div class="statistics-overview-surface rounded-lg border border-primary/30 p-4 sm:p-3">
      <div class="flex flex-col gap-7">
        <div
          class="stats-runes-paths-grid grid min-w-0 gap-x-4 gap-y-8 overflow-x-auto pb-2 lg:gap-x-6"
          style="grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr))"
        >
          <div
            v-for="{ path, cells } in pathsWithCells"
            v-show="cells.length > 0"
            :key="path.id"
            class="stats-runes-path flex min-w-[9.5rem] flex-col gap-2"
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
                    ' — pR: ' +
                    Number(cell.stats.pickrate).toFixed(2) +
                    '%, WR: ' +
                    Number(cell.stats.winrate).toFixed(2) +
                    '%'
                  "
                >
                  <img
                    :src="getRuneImageUrl(gameVersion, cell.rune.icon)"
                    :alt="cell.rune.name"
                    width="24"
                    height="24"
                    class="h-6 w-6 rounded-full bg-black/25 object-contain"
                  />
                  <span
                    class="text-[11px] font-bold tabular-nums leading-none"
                    :class="wrClass(cell.stats.winrate)"
                    >WR: {{ Number(cell.stats.winrate).toFixed(1) }}</span
                  >
                  <span class="text-[10px] tabular-nums leading-none text-text/60"
                    >pR: {{ Number(cell.stats.pickrate).toFixed(1) }}</span
                  >
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
                <div v-else class="flex min-w-[2rem] flex-col items-center gap-1">
                  <img
                    :src="getRuneImageUrl(gameVersion, cell.rune.icon)"
                    :alt="cell.rune.name"
                    width="24"
                    height="24"
                    class="h-6 w-6 rounded-full bg-black/20 object-contain opacity-50"
                  />
                  <span class="text-[10px] text-text/45">—</span>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Fragments -->
        <div>
          <div class="flex flex-row flex-wrap items-end justify-center gap-8 sm:gap-12 md:gap-16">
            <div
              v-for="row in SHARD_ROWS"
              :key="'shard-trio-' + row.slot"
              class="flex items-end justify-center gap-2"
            >
              <div
                v-for="sid in row.ids"
                :key="row.slot + '-' + sid"
                class="flex min-w-[1.75rem] flex-col items-center gap-0.5"
              >
                <img
                  :src="getShardIcon(sid)"
                  :alt="shardName(sid)"
                  width="16"
                  height="16"
                  class="stats-runes-shard-icon h-4 w-4 rounded-full bg-black/25 object-contain"
                />
                <template v-if="shardStat(sid, row.slot)">
                  <span
                    class="text-[11px] font-bold tabular-nums"
                    :class="wrClass(shardStat(sid, row.slot)!.winrate)"
                    >WR: {{ Number(shardStat(sid, row.slot)!.winrate).toFixed(1) }}</span
                  >
                  <span class="text-[10px] tabular-nums text-text/50"
                    >pR: {{ Number(shardStat(sid, row.slot)!.pickrate).toFixed(1) }}</span
                  >
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
      </div>
    </div>

    <!-- Sets : plus / moins pick, meilleur / pire WR -->
    <div class="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4 2xl:gap-3">
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
        <h4 class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent/90">
          {{ block.title }}
        </h4>
        <div class="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
          <div
            v-for="(row, idx) in block.list.map(s => ({
              set: s,
              ly: runeSetLayout(s.runes, s.shards ?? null),
            }))"
            :key="block.key + '-' + idx"
            class="rune-set-card statistics-overview-surface relative min-w-0 rounded-lg border border-primary/30 px-4 pb-3 pt-5"
          >
            <span
              class="absolute left-0 top-0 z-10 flex h-5 min-w-5 items-center justify-center rounded-md bg-primary/30 px-1 text-[10px] font-bold tabular-nums text-text/90"
              aria-hidden="true"
            >
              {{ idx + 1 }}
            </span>
            <div class="rune-set-build-strip flex min-w-0 flex-col gap-2">
              <!-- Clé de voûte seule (hors ligne d’alignement avec le secondaire) -->
              <div v-if="row.ly.keystone && getRuneById(row.ly.keystone)" class="flex shrink-0">
                <img
                  :src="getRuneImageUrl(gameVersion, getRuneById(row.ly.keystone)!.icon)"
                  :alt="getRuneById(row.ly.keystone)!.name"
                  class="rune-set-keystone-img shrink-0 rounded-full object-cover"
                  width="64"
                  height="64"
                />
              </div>
              <!-- Primaire / secondaire : deux colonnes, runes empilées et alignées en haut -->
              <div
                v-if="
                  row.ly.primaryRow.length || row.ly.secondaryPath || row.ly.secondaryRunes.length
                "
                class="grid min-w-0 items-start gap-x-3 gap-y-1"
                :class="
                  row.ly.primaryRow.length && (row.ly.secondaryPath || row.ly.secondaryRunes.length)
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
                "
              >
                <div
                  v-if="row.ly.primaryRow.length"
                  class="flex min-w-0 flex-col items-start gap-1"
                >
                  <template v-for="rid in row.ly.primaryRow" :key="'p-' + rid">
                    <img
                      v-if="getRuneById(rid)"
                      :src="getRuneImageUrl(gameVersion, getRuneById(rid)!.icon)"
                      :alt="getRuneById(rid)!.name"
                      :title="getRuneById(rid)!.name"
                      class="rune-set-small-rune rounded-full object-cover"
                      width="28"
                      height="28"
                    />
                  </template>
                </div>
                <div
                  v-if="row.ly.secondaryPath || row.ly.secondaryRunes.length"
                  class="rune-set-secondary-group flex min-w-0 flex-col items-start gap-1"
                >
                  <div
                    v-if="row.ly.secondaryPath"
                    class="rune-set-path-icon flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full"
                  >
                    <span
                      class="block h-[28px] w-[28px] rounded-full"
                      :style="{
                        backgroundColor: getRunePathColor(
                          row.ly.secondaryPath.icon,
                          row.ly.secondaryPath.id,
                          row.ly.secondaryPath.name
                        ),
                        WebkitMaskImage: `url(${getRunePathImageUrl(
                          gameVersion,
                          row.ly.secondaryPath.icon,
                          row.ly.secondaryPath.id,
                          row.ly.secondaryPath.name
                        )})`,
                        maskImage: `url(${getRunePathImageUrl(
                          gameVersion,
                          row.ly.secondaryPath.icon,
                          row.ly.secondaryPath.id,
                          row.ly.secondaryPath.name
                        )})`,
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                      }"
                    />
                  </div>
                  <template v-for="rid in row.ly.secondaryRunes" :key="'s-' + rid">
                    <img
                      v-if="getRuneById(rid)"
                      :src="getRuneImageUrl(gameVersion, getRuneById(rid)!.icon)"
                      :alt="getRuneById(rid)!.name"
                      :title="getRuneById(rid)!.name"
                      class="rune-set-small-rune rounded-full object-cover"
                      width="28"
                      height="28"
                    />
                  </template>
                </div>
              </div>
              <div
                v-if="row.ly.shards.length"
                class="rune-set-shards-row -mx-4 mt-2 flex w-[calc(100%+2rem)] max-w-none items-center justify-between self-stretch px-[3px]"
              >
                <img
                  v-for="sid in row.ly.shards"
                  :key="'sh-' + sid"
                  :src="getShardIcon(sid)"
                  :alt="shardName(sid)"
                  :title="shardName(sid)"
                  class="rune-set-shard-img shrink-0 rounded-full bg-black/25 object-contain"
                  width="22"
                  height="22"
                />
              </div>
            </div>
            <div
              class="mt-3 flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs leading-tight text-text/85"
            >
              <span
                ><span class="text-text/55">WR:</span>
                {{ ' ' }}
                <span class="font-semibold tabular-nums" :class="wrClass(row.set.winrate)">{{
                  Number(row.set.winrate).toFixed(2)
                }}</span
                >%</span
              >
              <span
                ><span class="text-text/55">pR:</span>
                {{ ' ' }}
                <span class="font-semibold tabular-nums">{{
                  Number(row.set.pickrate).toFixed(2)
                }}</span
                >%</span
              >
              <template v-if="comparisonVersion && !baselinePending">
                <span
                  class="text-[10px] tabular-nums"
                  :class="deltaClass(row.set.pickrate, baselineStatsForRuneSet(row.set)?.pickrate)"
                >
                  ΔP
                  {{ formatDelta(row.set.pickrate, baselineStatsForRuneSet(row.set)?.pickrate) }}
                </span>
                <span
                  class="text-[10px] tabular-nums"
                  :class="deltaClass(row.set.winrate, baselineStatsForRuneSet(row.set)?.winrate)"
                >
                  ΔWR
                  {{ formatDelta(row.set.winrate, baselineStatsForRuneSet(row.set)?.winrate) }}
                </span>
              </template>
            </div>
          </div>
          <p v-if="!block.list.length" class="text-xs text-text/50">
            {{ t('statisticsPage.overviewNoData') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-runes-paths-grid {
  scrollbar-gutter: stable;
}
.stats-runes-shard-icon {
  flex-shrink: 0;
}
.rune-set-keystone-img {
  width: 64px;
  height: 64px;
  min-width: 64px;
  min-height: 64px;
}
.rune-set-small-rune {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  flex-shrink: 0;
}
.rune-set-shard-img {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
}
.rune-set-build-strip {
  min-height: 0;
}
.rune-set-shards-row {
  box-sizing: border-box;
}
</style>
