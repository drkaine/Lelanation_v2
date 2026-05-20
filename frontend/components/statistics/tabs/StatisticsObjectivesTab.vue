<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'

const p = inject('statisticsPageCtx') as any
const tooltipsEnabled = inject('tooltipsEnabled', ref(true)) as Ref<boolean>
const objectivesDisplayMode = ref<'obtention' | 'winrate'>('obtention')

function syncToggleObjective(key: string) {
  p.toggleObjective(key)
  p.toggleSidesObjective(key)
}

function sidesDrakeSoulByKey(key: string): { byBlue: number; byRed: number } {
  const row = p.sidesDrakeSoulRows.find((r: { key: string }) => r.key === key)
  return row ? { byBlue: row.byBlue, byRed: row.byRed } : { byBlue: 0, byRed: 0 }
}

function pct(count: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  return (Number(count) / total) * 100
}

function formatPct(value: number | null): string {
  if (value == null) return '—'
  return `${value.toFixed(2)}%`
}

function formatPctWithCount(pctValue: number | null, count: number): string {
  if (pctValue == null) return '—'
  if (count > 0) return `${pctValue.toFixed(2)}% (${formatCompactCount(count)})`
  return `${pctValue.toFixed(2)}%`
}

/** Limite les comptages soul agrégés (évite >100 % si chevauchement des types). */
function cappedSoulObtentionCount(raw: number, matchCount: number): number {
  const n = Number(raw) || 0
  if (n <= 0 || matchCount <= 0) return 0
  return Math.min(n, matchCount)
}

function formatDelta(value: number | null): string {
  if (value == null) return ''
  const sign = value > 0 ? '+' : ''
  return `(${sign}${value.toFixed(2)} %)`
}

function deltaColorClass(delta: number | null): string {
  if (delta == null || delta === 0) return 'text-text/80'
  return delta > 0 ? 'text-emerald-400' : 'text-rose-400'
}

function teamFirstPctParts(
  objectiveKey: string,
  side: 'win' | 'loss'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0)
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curObj = curData.objectives?.[objectiveKey] ?? {}
  const curCount = side === 'win' ? Number(curObj.firstByWin ?? 0) : Number(curObj.firstByLoss ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))
  const baseData = p.overviewTeamsBaselineData
  const baseObj = baseData?.objectives?.[objectiveKey] ?? null
  const baseCount =
    baseObj == null
      ? null
      : side === 'win'
        ? Number(baseObj.firstByWin ?? 0)
        : Number(baseObj.firstByLoss ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function sideFirstPctParts(
  objectiveKey: string,
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewSidesData
  if (!curData || curData.matchCount <= 0)
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curObj = curData.objectivesBySideTable?.[objectiveKey] ?? {}
  const curCount =
    side === 'blue' ? Number(curObj.firstByBlue ?? 0) : Number(curObj.firstByRed ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))
  const baseData = p.overviewSidesBaselineData
  const baseObj = baseData?.objectivesBySideTable?.[objectiveKey] ?? null
  const baseCount =
    baseObj == null
      ? null
      : side === 'blue'
        ? Number(baseObj.firstByBlue ?? 0)
        : Number(baseObj.firstByRed ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

const FIRST_WINRATE_KEYS = [
  'firstBlood',
  'baron',
  'dragon',
  'tower',
  'inhibitor',
  'riftHerald',
  'horde',
] as const

function formatCompactCount(n: number): string {
  const v = Math.round(Number(n) || 0)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 10_000) return `${Math.round(v / 1000)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(v)
}

function formatFirstObjectiveWr(value: number | null | undefined, games?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const wr = `${clampSoulWinrate(value).toFixed(2)}%`
  if (games != null && games > 0) return `${wr} (${formatCompactCount(games)})`
  return wr
}

const GAME_FIRST_BUCKETS: Array<{ bucket: number; key: string }> = [
  { bucket: 1, key: 'firstBlood' },
  { bucket: 2, key: 'tower' },
  { bucket: 3, key: 'dragon' },
  { bucket: 4, key: 'baron' },
  { bucket: 5, key: 'horde' },
  { bucket: 6, key: 'riftHerald' },
  { bucket: 7, key: 'inhibitor' },
]

const openGameFirstKeys = ref(new Set<string>())

function toggleGameFirst() {
  if (openGameFirstKeys.value.has('gameFirst')) openGameFirstKeys.value.delete('gameFirst')
  else openGameFirstKeys.value.add('gameFirst')
}

function gameFirstBucketLabel(bucketKey: string): string {
  return p.t(`statisticsPage.gameFirstBucket_${bucketKey}`)
}

function gameFirstCounts(): number[] {
  const data = p.overviewTeamsData?.gameFirstObjective
  if (!data) return []
  const set = new Set<number>()
  for (const dist of [data.distributionByWin, data.distributionByLoss]) {
    for (const k of Object.keys(dist ?? {})) {
      const n = parseInt(k, 10)
      if (Number.isFinite(n) && n > 0) set.add(n)
    }
  }
  return [...set].sort((a, b) => a - b)
}

function gameFirstPercentForCount(bucket: number, byWin: boolean): string {
  const data = p.overviewTeamsData
  if (!data?.matchCount) return '—'
  const dist = byWin
    ? data.gameFirstObjective?.distributionByWin
    : data.gameFirstObjective?.distributionByLoss
  const n = Number(dist?.[String(bucket)] ?? 0)
  if (n <= 0) return '—'
  return ((n / data.matchCount) * 100).toFixed(2) + '%'
}

function gameFirstPercentForCountSides(bucket: number, side: 'blue' | 'red'): string {
  const data = p.overviewSidesData
  if (!data?.matchCount) return '—'
  const dist =
    side === 'blue'
      ? data.gameFirstObjective?.distributionByBlue
      : data.gameFirstObjective?.distributionByRed
  const n = Number(dist?.[String(bucket)] ?? 0)
  if (n <= 0) return '—'
  return ((n / data.matchCount) * 100).toFixed(2) + '%'
}

function gameFirstPctParts(side: 'win' | 'loss'): {
  current: string
  delta: string
  deltaClass: string
} {
  const curData = p.overviewTeamsData
  if (!curData?.gameFirstObjective || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const dist =
    side === 'win'
      ? curData.gameFirstObjective.distributionByWin
      : curData.gameFirstObjective.distributionByLoss
  const curCount = Object.values(dist ?? {}).reduce((s, v) => s + Number(v ?? 0), 0)
  const curPct = pct(curCount, curData.matchCount)
  const baseData = p.overviewTeamsBaselineData?.gameFirstObjective
  const baseDist =
    baseData == null
      ? null
      : side === 'win'
        ? baseData.distributionByWin
        : baseData.distributionByLoss
  const baseCount =
    baseDist == null ? null : Object.values(baseDist).reduce((s, v) => s + Number(v ?? 0), 0)
  const basePct =
    p.overviewTeamsBaselineData && p.overviewTeamsBaselineData.matchCount > 0 && baseCount != null
      ? pct(baseCount, p.overviewTeamsBaselineData.matchCount)
      : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function gameFirstPctPartsSides(side: 'blue' | 'red'): {
  current: string
  delta: string
  deltaClass: string
} {
  const curData = p.overviewSidesData
  if (!curData?.gameFirstObjective || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const dist =
    side === 'blue'
      ? curData.gameFirstObjective.distributionByBlue
      : curData.gameFirstObjective.distributionByRed
  const curCount = Object.values(dist ?? {}).reduce((s, v) => s + Number(v ?? 0), 0)
  const curPct = pct(curCount, curData.matchCount)
  return {
    current: formatPct(curPct),
    delta: '',
    deltaClass: 'text-text/80',
  }
}

/** Winrate borné à [0, 100] (évite affichage >100 % si données agrégées incohérentes). */
function clampSoulWinrate(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

type SoulSideRow = {
  byBlue?: number
  byRed?: number
  winrateBlue?: number | null
  winrateRed?: number | null
}

type SoulTeamRow = { byWin?: number; byLoss?: number }

/** WR global = victoires / parties avec soul, tous types et côtés confondus (moyenne pondérée). */
function poolSoulSecureWinrateFromSideRows(rows: SoulSideRow[]): number | null {
  let games = 0
  let wins = 0
  for (const row of rows) {
    for (const { g, wr } of [
      { g: Number(row.byBlue ?? 0), wr: row.winrateBlue },
      { g: Number(row.byRed ?? 0), wr: row.winrateRed },
    ]) {
      if (g > 0 && wr != null && Number.isFinite(Number(wr))) {
        games += g
        wins += g * (clampSoulWinrate(Number(wr)) / 100)
      }
    }
  }
  if (games <= 0) return null
  return clampSoulWinrate((wins / games) * 100)
}

function poolSoulSecureWinrateFromTeamRows(rows: SoulTeamRow[]): number | null {
  let games = 0
  let wins = 0
  for (const row of rows) {
    const w = Number(row.byWin ?? 0)
    const l = Number(row.byLoss ?? 0)
    const total = w + l
    if (total > 0) {
      games += total
      wins += w
    }
  }
  if (games <= 0) return null
  return clampSoulWinrate((wins / games) * 100)
}

function firstWinrateObjectiveLabel(key: (typeof FIRST_WINRATE_KEYS)[number]): string {
  if (key === 'firstBlood') return p.t('statisticsPage.overviewTeamsFirstBlood')
  return p.t(`statisticsPage.overviewTeamsObjective_${key}`)
}

function objectiveFirstWinrateGlobalParts(key: (typeof FIRST_WINRATE_KEYS)[number]): {
  current: string
  delta: string
  deltaClass: string
} {
  const cur = p.overviewTeamsData?.objectiveFirstWinrateGlobal?.[key]
  const base = p.overviewTeamsBaselineData?.objectiveFirstWinrateGlobal?.[key]
  const curV = cur ?? null
  const baseV = base ?? null
  const delta = curV != null && baseV != null ? curV - baseV : null
  return {
    current: formatFirstObjectiveWr(curV),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function objectiveFirstWinrateSideParts(
  key: (typeof FIRST_WINRATE_KEYS)[number],
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const cur = p.overviewSidesData?.objectiveFirstWinrateBySide?.[key]?.[side]
  const base = p.overviewSidesBaselineData?.objectiveFirstWinrateBySide?.[key]?.[side]
  const games = p.overviewSidesData?.objectiveFirstWinrateGamesBySide?.[key]?.[side]
  const curV = cur ?? null
  const baseV = base ?? null
  const delta = curV != null && baseV != null ? curV - baseV : null
  return {
    current: formatFirstObjectiveWr(curV, games),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function drakeTypeWinrateGlobalParts(key: string): {
  current: string
  delta: string
  deltaClass: string
} {
  const curRow = p.drakeTypeRows.find(
    (r: { key: string; securedWinrateGlobal?: number | null }) => r.key === key
  )
  const curWr =
    curRow?.securedWinrateGlobal != null
      ? Number(curRow.securedWinrateGlobal)
      : (() => {
          const cw = Number(curRow?.byWin ?? 0)
          const cl = Number(curRow?.byLoss ?? 0)
          const cn = cw + cl
          return cn > 0 ? (cw / cn) * 100 : null
        })()

  const baseData = p.overviewTeamsBaselineData
  const baseRow = baseData?.drakes?.types?.[key] as
    | { byWin?: number; byLoss?: number; securedWinrateGlobal?: number | null }
    | undefined
  const baseWr =
    baseRow?.securedWinrateGlobal != null
      ? Number(baseRow.securedWinrateGlobal)
      : (() => {
          const bw = Number(baseRow?.byWin ?? 0)
          const bl = Number(baseRow?.byLoss ?? 0)
          const bn = bw + bl
          return bn > 0 ? (bw / bn) * 100 : null
        })()
  const delta = curWr != null && baseWr != null ? curWr - baseWr : null
  return {
    current: formatFirstObjectiveWr(curWr),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function drakeTypeWinrateSideParts(
  key: string,
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const curRow = p.sidesDrakeTypeRows.find((r: { key: string }) => r.key === key)
  const curWr =
    side === 'blue'
      ? (curRow?.winrateBlue as number | null | undefined)
      : (curRow?.winrateRed as number | null | undefined)
  const baseRow = p.overviewSidesBaselineData?.drakesBySide?.types?.[key]
  const baseWr =
    side === 'blue'
      ? (baseRow?.winrateBlue as number | null | undefined)
      : (baseRow?.winrateRed as number | null | undefined)
  const curV = curWr ?? null
  const baseV = baseWr ?? null
  const delta = curV != null && baseV != null ? curV - baseV : null
  return {
    current: formatFirstObjectiveWr(curV),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

const openDrakeTypeKeys = ref(new Set<string>())

function toggleDrakeType(key: string) {
  if (openDrakeTypeKeys.value.has(key)) openDrakeTypeKeys.value.delete(key)
  else openDrakeTypeKeys.value.add(key)
}

function drakeTypePctParts(
  key: string,
  side: 'win' | 'loss'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const curRow = p.drakeTypeRows.find((r: { key: string }) => r.key === key)
  const curCount = side === 'win' ? Number(curRow?.byWin ?? 0) : Number(curRow?.byLoss ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewTeamsBaselineData
  const baseDrakes = baseData?.drakes?.types?.[key]
  const baseCount =
    baseDrakes == null
      ? null
      : side === 'win'
        ? Number(baseDrakes.byWin ?? 0)
        : Number(baseDrakes.byLoss ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPctWithCount(curPct, curCount),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function drakeTypePctPartsSides(
  key: string,
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewSidesData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const curRow = p.sidesDrakeTypeRows.find((r: { key: string }) => r.key === key)
  const curCount = side === 'blue' ? Number(curRow?.byBlue ?? 0) : Number(curRow?.byRed ?? 0)
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewSidesBaselineData
  const baseDrakes = baseData?.drakesBySide?.types?.[key]
  const baseCount =
    baseDrakes == null
      ? null
      : side === 'blue'
        ? Number(baseDrakes.byBlue ?? 0)
        : Number(baseDrakes.byRed ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPctWithCount(curPct, curCount),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function drakeSoulPctParts(
  key: string,
  side: 'win' | 'loss'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const curRow = p.drakeSoulRows.find((r: { key: string }) => r.key === key)
  const curCount = side === 'win' ? Number(curRow?.byWin ?? 0) : Number(curRow?.byLoss ?? 0)
  if (curCount <= 0) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewTeamsBaselineData
  const baseSoul = baseData?.drakes?.souls?.[key]
  const baseCount =
    baseSoul == null
      ? null
      : side === 'win'
        ? Number(baseSoul.byWin ?? 0)
        : Number(baseSoul.byLoss ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPctWithCount(curPct, curCount),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function drakeSoulPctPartsSides(
  key: string,
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewSidesData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const curSoul = sidesDrakeSoulByKey(key)
  const curCount = side === 'blue' ? Number(curSoul.byBlue ?? 0) : Number(curSoul.byRed ?? 0)
  if (curCount <= 0) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewSidesBaselineData
  const baseSoul = baseData?.drakesBySide?.souls?.[key]
  const baseCount =
    baseSoul == null
      ? null
      : side === 'blue'
        ? Number(baseSoul.byBlue ?? 0)
        : Number(baseSoul.byRed ?? 0)
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null
      ? pct(baseCount, Number(baseData.matchCount))
      : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPctWithCount(curPct, curCount),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function soulGlobalPctParts(side: 'win' | 'loss'): {
  current: string
  delta: string
  deltaClass: string
} {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const rawCount =
    side === 'win' ? Number(p.drakeSoulGlobal.byWin ?? 0) : Number(p.drakeSoulGlobal.byLoss ?? 0)
  const curCount = cappedSoulObtentionCount(rawCount, Number(curData.matchCount))
  if (curCount <= 0) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewTeamsBaselineData
  const baseSouls = baseData?.drakes?.souls as
    | Record<string, { byWin?: number; byLoss?: number }>
    | undefined
  const baseRaw =
    baseSouls == null
      ? null
      : Object.values(baseSouls).reduce(
          (acc, soul) => acc + Number(side === 'win' ? (soul?.byWin ?? 0) : (soul?.byLoss ?? 0)),
          0
        )
  const baseCount =
    baseData && baseRaw != null
      ? cappedSoulObtentionCount(baseRaw, Number(baseData.matchCount))
      : null
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null && baseCount > 0
      ? pct(baseCount, Number(baseData.matchCount))
      : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPctWithCount(curPct, curCount),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function soulGlobalPctPartsSides(side: 'blue' | 'red'): {
  current: string
  delta: string
  deltaClass: string
} {
  const curData = p.overviewSidesData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  }
  const rawCount =
    side === 'blue'
      ? Number(p.sidesDrakeSoulGlobal.byBlue ?? 0)
      : Number(p.sidesDrakeSoulGlobal.byRed ?? 0)
  const curCount = cappedSoulObtentionCount(rawCount, Number(curData.matchCount))
  if (curCount <= 0) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curPct = pct(curCount, Number(curData.matchCount))

  const baseData = p.overviewSidesBaselineData
  const baseSouls = baseData?.drakesBySide?.souls as
    | Record<string, { byBlue?: number; byRed?: number }>
    | undefined
  const baseRaw =
    baseSouls == null
      ? null
      : Object.values(baseSouls).reduce(
          (acc, soul) => acc + Number(side === 'blue' ? (soul?.byBlue ?? 0) : (soul?.byRed ?? 0)),
          0
        )
  const baseCount =
    baseData && baseRaw != null
      ? cappedSoulObtentionCount(baseRaw, Number(baseData.matchCount))
      : null
  const basePct =
    baseData && baseData.matchCount > 0 && baseCount != null && baseCount > 0
      ? pct(baseCount, Number(baseData.matchCount))
      : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPctWithCount(curPct, curCount),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

const DONUT_RADIUS = 48
const DONUT_STROKE = 14
const DONUT_CIRCLE = 2 * Math.PI * DONUT_RADIUS

const DONUT_COLORS: Record<string, string> = {
  elder: '#7c3aed',
  earth: '#f59e0b',
  water: '#14b8a6',
  wind: '#eff6ff',
  fire: '#ef4444',
  hextec: '#00e5ff',
  chem: '#22c55e',
}

function rowColor(key: string): string {
  return DONUT_COLORS[key] ?? '#64748b'
}

type DistRow = { key: string; label: string; value: number; color: string }

function sumDistributionCounts(
  distWin?: Record<string, number>,
  distLoss?: Record<string, number>
): number {
  let total = 0
  for (const dist of [distWin, distLoss]) {
    if (!dist || typeof dist !== 'object') continue
    for (const n of Object.values(dist)) total += Number(n ?? 0)
  }
  return total
}

function buildDistRows(
  rows: Array<{ key: string; label: string; byWin: number; byLoss: number }>
): DistRow[] {
  return rows
    .map(row => ({
      key: row.key,
      label: row.label,
      value: Number(row.byWin ?? 0) + Number(row.byLoss ?? 0),
      color: rowColor(row.key),
    }))
    .filter(row => row.value > 0)
}

/** Répartition donut drakes : histogramme (kills par type), sinon obtention. */
function buildDrakeDistRows(
  rows: Array<{
    key: string
    label: string
    byWin: number
    byLoss: number
    distributionByWin?: Record<string, number>
    distributionByLoss?: Record<string, number>
  }>
): DistRow[] {
  return rows
    .map(row => {
      const fromHist = sumDistributionCounts(row.distributionByWin, row.distributionByLoss)
      const fromObtention = Number(row.byWin ?? 0) + Number(row.byLoss ?? 0)
      return {
        key: row.key,
        label: row.label,
        value: fromHist > 0 ? fromHist : fromObtention,
        color: rowColor(row.key),
      }
    })
    .filter(row => row.value > 0)
}

const drakeDistRows = computed<DistRow[]>(() => buildDrakeDistRows(p.drakeTypeRows ?? []))
const soulDistRows = computed<DistRow[]>(() => buildDistRows(p.drakeSoulRows ?? []))

const showDistributionCards = computed(
  () => (p.overviewTeamsData?.matchCount ?? 0) > 0 || (p.overviewSidesData?.matchCount ?? 0) > 0
)

function distTotal(rows: DistRow[]): number {
  return rows.reduce((sum, row) => sum + row.value, 0)
}

function distPct(value: number, total: number): string {
  if (!total) return '—'
  return `${((value / total) * 100).toFixed(2)}%`
}

function donutSegments(rows: DistRow[]): Array<{ arc: number; offset: number; color: string }> {
  const total = distTotal(rows)
  if (!total) return []
  let offset = 0
  return rows.map(row => {
    const arc = DONUT_CIRCLE * (row.value / total)
    const segment = { arc, offset, color: row.color }
    offset += arc
    return segment
  })
}

const drakeDonutSegments = computed(() => donutSegments(drakeDistRows.value))
const soulDonutSegments = computed(() => donutSegments(soulDistRows.value))
const drakeDistTotal = computed(() => distTotal(drakeDistRows.value))
const soulDistTotal = computed(() => distTotal(soulDistRows.value))

function donutTooltip(row: DistRow, total: number): string {
  return `${row.label}: ${distPct(row.value, total)} (${row.value.toLocaleString()})`
}

/** % victoire de l'équipe qui a obtenu la soul (byWin = victoires avec soul, byLoss = défaites avec soul). */
function soulSecureWinrateParts(key: string): {
  current: string
  value: number | null
  delta: string
  deltaDisplay: string
  deltaClass: string
} {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0) {
    return { current: '—', value: null, delta: '', deltaDisplay: '—', deltaClass: 'text-text/60' }
  }
  const curRow = p.drakeSoulRows.find((r: { key: string }) => r.key === key)
  const cw = Number(curRow?.byWin ?? 0)
  const cl = Number(curRow?.byLoss ?? 0)
  const cn = cw + cl
  const curWr = cn > 0 ? clampSoulWinrate((cw / cn) * 100) : null
  const current = formatFirstObjectiveWr(curWr)

  const baseData = p.overviewTeamsBaselineData
  const souls = baseData?.drakes?.souls as
    | Record<string, { byWin?: number; byLoss?: number }>
    | undefined
  const baseSoul = souls?.[key]
  const bw = Number(baseSoul?.byWin ?? 0)
  const bl = Number(baseSoul?.byLoss ?? 0)
  const bn = bw + bl
  const baseWr = bn > 0 ? clampSoulWinrate((bw / bn) * 100) : null
  const delta = curWr != null && baseWr != null ? curWr - baseWr : null
  const deltaFmt = formatDelta(delta)
  return {
    current,
    value: curWr,
    delta: deltaFmt,
    deltaDisplay: deltaFmt,
    deltaClass: deltaColorClass(delta),
  }
}

/** Winrate global quand l'équipe a obtenu une soul (tous types confondus). */
function soulGlobalSecureWinrateParts(): {
  current: string
  delta: string
  deltaClass: string
  deltaDisplay: string
} {
  const sideRows = (p.sidesDrakeSoulRows ?? []) as SoulSideRow[]
  const teamRows = (p.drakeSoulRows ?? []) as SoulTeamRow[]
  const curWr =
    poolSoulSecureWinrateFromSideRows(sideRows) ?? poolSoulSecureWinrateFromTeamRows(teamRows)
  const current = formatFirstObjectiveWr(curWr)

  const baseSideRows = p.overviewSidesBaselineData?.drakesBySide?.souls
    ? (Object.values(
        p.overviewSidesBaselineData.drakesBySide.souls as Record<string, SoulSideRow>
      ) as SoulSideRow[])
    : []
  const baseTeamRows = p.overviewTeamsBaselineData?.drakes?.souls
    ? (Object.values(
        p.overviewTeamsBaselineData.drakes.souls as Record<string, SoulTeamRow>
      ) as SoulTeamRow[])
    : []
  const baseWr =
    poolSoulSecureWinrateFromSideRows(baseSideRows) ??
    poolSoulSecureWinrateFromTeamRows(baseTeamRows)
  const delta = curWr != null && baseWr != null ? curWr - baseWr : null
  const deltaFmt = formatDelta(delta)
  return {
    current,
    delta: deltaFmt,
    deltaDisplay: deltaFmt,
    deltaClass: deltaColorClass(delta),
  }
}

function weightedSoulSideSecureWinrate(rows: SoulSideRow[], side: 'blue' | 'red'): number | null {
  let games = 0
  let wins = 0
  for (const row of rows) {
    const g = side === 'blue' ? Number(row.byBlue ?? 0) : Number(row.byRed ?? 0)
    const wr = side === 'blue' ? row.winrateBlue : row.winrateRed
    if (g > 0 && wr != null && Number.isFinite(Number(wr))) {
      games += g
      wins += g * (clampSoulWinrate(Number(wr)) / 100)
    }
  }
  if (games <= 0) return null
  return clampSoulWinrate((wins / games) * 100)
}

function soulGlobalSecureWinrateSideParts(side: 'blue' | 'red'): {
  current: string
  delta: string
  deltaClass: string
} {
  const curWr = weightedSoulSideSecureWinrate((p.sidesDrakeSoulRows ?? []) as SoulSideRow[], side)
  const baseSouls = p.overviewSidesBaselineData?.drakesBySide?.souls as
    | Record<string, SoulSideRow>
    | undefined
  const baseRows = baseSouls ? Object.values(baseSouls) : []
  const baseWr = weightedSoulSideSecureWinrate(baseRows, side)
  const delta = curWr != null && baseWr != null ? curWr - baseWr : null
  return {
    current: formatFirstObjectiveWr(curWr),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function soulSecureWinrateSideParts(
  key: string,
  side: 'blue' | 'red'
): { current: string; delta: string; deltaClass: string } {
  const curRow = p.sidesDrakeSoulRows.find((r: { key: string }) => r.key === key)
  const curWr =
    side === 'blue'
      ? (curRow?.winrateBlue as number | null | undefined)
      : (curRow?.winrateRed as number | null | undefined)
  const baseRow = p.overviewSidesBaselineData?.drakesBySide?.souls?.[key]
  const baseWr =
    side === 'blue'
      ? (baseRow?.winrateBlue as number | null | undefined)
      : (baseRow?.winrateRed as number | null | undefined)
  const curV = curWr != null ? clampSoulWinrate(curWr) : null
  const baseV = baseWr != null ? clampSoulWinrate(baseWr) : null
  const delta = curV != null && baseV != null ? curV - baseV : null
  return {
    current: formatFirstObjectiveWr(curV),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

const drakeTypeWinrateRows = computed(() =>
  (p.drakeTypeRows as Array<{ key: string; label: string; byWin: number; byLoss: number }>)
    .map(row => {
      const parts = drakeTypeWinrateGlobalParts(row.key)
      return { ...row, parts, wr: Number(parts.current.replace('%', '')) || 0 }
    })
    .sort((a, b) => b.wr - a.wr)
)

const drakeSoulWinrateRows = computed(() =>
  (p.drakeSoulRows as Array<{ key: string; label: string; byWin: number; byLoss: number }>)
    .map(row => {
      const parts = soulSecureWinrateParts(row.key)
      return { ...row, parts, wr: parts.value ?? -1 }
    })
    .sort((a, b) => b.wr - a.wr)
)
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="
        (p.overviewTeamsPending && !(p.overviewTeamsData && p.overviewTeamsData.matchCount > 0)) ||
        (p.overviewSidesPending && !(p.overviewSidesData && p.overviewSidesData.matchCount > 0))
      "
      class="text-text/70"
    >
      {{ p.t('statisticsPage.loading') }}
    </div>

    <div
      v-else-if="
        !(p.overviewTeamsData && p.overviewTeamsData.matchCount > 0) &&
        !(p.overviewSidesData && p.overviewSidesData.matchCount > 0)
      "
      class="rounded border border-primary/30 bg-surface/50 p-4 text-sm text-text/70"
    >
      {{ p.t('statisticsPage.objectivesCombinedEmpty') }}
    </div>

    <div
      v-else
      class="fast-stat-card fast-stat-card-objectives w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
    >
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="shrink-0 text-base leading-none transition-colors"
          :class="
            p.cardIsFavorite('overview.objectives')
              ? 'text-amber-300 hover:text-amber-200'
              : 'text-text/45 grayscale hover:text-text/75'
          "
          :title="
            p.cardIsFavorite('overview.objectives') ? 'Retirer des favoris' : 'Ajouter aux favoris'
          "
          @click="
            p.toggleFavoriteCard(
              'overview.objectives',
              p.t('statisticsPage.overviewTeamsObjectives')
            )
          "
        >
          {{ p.cardIsFavorite('overview.objectives') ? '★' : '☆' }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-semibold transition-colors"
          :class="
            p.objectivesPanelTab === 'objectives'
              ? 'bg-accent text-background'
              : 'bg-black/20 text-text/80 hover:bg-white/10'
          "
          @click="p.setObjectivesPanelTab('objectives')"
        >
          {{ p.t('statisticsPage.objectivesTabMain') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-semibold transition-colors"
          :class="
            p.objectivesPanelTab === 'drakeTypes'
              ? 'bg-accent text-background'
              : 'bg-black/20 text-text/80 hover:bg-white/10'
          "
          @click="p.setObjectivesPanelTab('drakeTypes')"
        >
          {{ p.t('statisticsPage.objectivesTabDrakeTypes') }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-xs font-semibold transition-colors"
          :class="
            p.objectivesPanelTab === 'drakeSouls'
              ? 'bg-accent text-background'
              : 'bg-black/20 text-text/80 hover:bg-white/10'
          "
          @click="p.setObjectivesPanelTab('drakeSouls')"
        >
          {{ p.t('statisticsPage.objectivesTabSouls') }}
        </button>
        <div class="ml-auto inline-flex overflow-hidden rounded border border-primary/30 text-xs">
          <button
            type="button"
            class="px-2 py-1 font-semibold transition-colors"
            :class="
              objectivesDisplayMode === 'obtention'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="objectivesDisplayMode = 'obtention'"
          >
            {{ p.t('statisticsPage.objectivesModeObtention') }}
          </button>
          <button
            type="button"
            class="border-l border-primary/30 px-2 py-1 font-semibold transition-colors"
            :class="
              objectivesDisplayMode === 'winrate'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="objectivesDisplayMode = 'winrate'"
          >
            {{ p.t('statisticsPage.objectivesModeWinrate') }}
          </button>
        </div>
        <span
          class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
          :aria-label="p.t('statisticsPage.tooltipOverviewObjectives')"
        >
          ⓘ
          <span
            role="tooltip"
            class="fast-stat-tooltip-popover fast-stat-tooltip-popover--objectives hidden group-hover/stat-tip:block"
          >
            {{ p.t('statisticsPage.tooltipOverviewObjectives') }}
            <span class="mt-1 block border-t border-primary/20 pt-1 text-text/80">
              {{ p.t('statisticsPage.tooltipSidesObjectives') }}
            </span>
          </span>
        </span>
      </div>

      <!-- Principal : premier par équipe + par côté -->
      <div
        v-if="p.objectivesPanelTab === 'objectives' && objectivesDisplayMode === 'obtention'"
        class="w-full min-w-0 overflow-x-auto"
      >
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsFirstByWin') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsFirstByLoss') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <tr>
              <td class="py-1.5 pr-2">
                {{ p.t('statisticsPage.overviewTeamsFirstBlood') }}
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ teamFirstPctParts('firstBlood', 'win').current }}
                <span :class="teamFirstPctParts('firstBlood', 'win').deltaClass">
                  {{ teamFirstPctParts('firstBlood', 'win').delta }}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ teamFirstPctParts('firstBlood', 'loss').current }}
                <span :class="teamFirstPctParts('firstBlood', 'loss').deltaClass">
                  {{ teamFirstPctParts('firstBlood', 'loss').delta }}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ sideFirstPctParts('firstBlood', 'blue').current }}
                <span :class="sideFirstPctParts('firstBlood', 'blue').deltaClass">
                  {{ sideFirstPctParts('firstBlood', 'blue').delta }}
                </span>
              </td>
              <td class="py-1.5 pl-1 text-center">
                {{ sideFirstPctParts('firstBlood', 'red').current }}
                <span :class="sideFirstPctParts('firstBlood', 'red').deltaClass">
                  {{ sideFirstPctParts('firstBlood', 'red').delta }}
                </span>
              </td>
            </tr>
            <tr>
              <td class="py-1.5 pr-2">
                <button
                  type="button"
                  class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                  @click="toggleGameFirst()"
                >
                  <span
                    class="inline-block transition-transform duration-200"
                    :class="openGameFirstKeys.has('gameFirst') ? 'rotate-180' : ''"
                    aria-hidden
                    >▼</span
                  >
                  {{ p.t('statisticsPage.overviewTeamsGameFirstObjective') }}
                </button>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ gameFirstPctParts('win').current }}
                <span :class="gameFirstPctParts('win').deltaClass">
                  {{ gameFirstPctParts('win').delta }}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ gameFirstPctParts('loss').current }}
                <span :class="gameFirstPctParts('loss').deltaClass">
                  {{ gameFirstPctParts('loss').delta }}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ gameFirstPctPartsSides('blue').current }}
              </td>
              <td class="py-1.5 pl-1 text-center">
                {{ gameFirstPctPartsSides('red').current }}
              </td>
            </tr>
            <template v-if="openGameFirstKeys.has('gameFirst')">
              <tr
                v-for="row in GAME_FIRST_BUCKETS.filter(b => gameFirstCounts().includes(b.bucket))"
                :key="'game-first-' + row.bucket"
                class="bg-surface/30"
              >
                <td class="py-1 pl-6 pr-2 text-text/70">{{ gameFirstBucketLabel(row.key) }}</td>
                <td class="px-1 py-1 text-center text-text/80">
                  {{ gameFirstPercentForCount(row.bucket, true) }}
                </td>
                <td class="px-1 py-1 text-center text-text/80">
                  {{ gameFirstPercentForCount(row.bucket, false) }}
                </td>
                <td class="px-1 py-1 text-center text-text/80">
                  {{ gameFirstPercentForCountSides(row.bucket, 'blue') }}
                </td>
                <td class="py-1 pl-1 text-center text-text/80">
                  {{ gameFirstPercentForCountSides(row.bucket, 'red') }}
                </td>
              </tr>
            </template>
            <template v-for="key in p.objectiveKeysWithKills" :key="key">
              <tr>
                <td class="py-1.5 pr-2">
                  <button
                    type="button"
                    class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                    @click="syncToggleObjective(key)"
                  >
                    <span
                      class="inline-block transition-transform duration-200"
                      :class="p.openObjectiveKeys.has(key) ? 'rotate-180' : ''"
                      aria-hidden
                      >▼</span
                    >
                    <img
                      v-if="p.objectiveIconSrc(key)"
                      :src="p.objectiveIconSrc(key)"
                      :alt="p.t('statisticsPage.overviewTeamsObjective_' + key)"
                      class="h-4 w-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      @error="p.onObjectiveIconError($event, key)"
                    />
                    {{ p.t('statisticsPage.overviewTeamsObjective_' + key) }}
                  </button>
                </td>
                <td class="px-1 py-1.5 text-center">
                  {{ teamFirstPctParts(key, 'win').current }}
                  <span :class="teamFirstPctParts(key, 'win').deltaClass">
                    {{ teamFirstPctParts(key, 'win').delta }}
                  </span>
                </td>
                <td class="px-1 py-1.5 text-center">
                  {{ teamFirstPctParts(key, 'loss').current }}
                  <span :class="teamFirstPctParts(key, 'loss').deltaClass">
                    {{ teamFirstPctParts(key, 'loss').delta }}
                  </span>
                </td>
                <td class="px-1 py-1.5 text-center">
                  {{ sideFirstPctParts(key, 'blue').current }}
                  <span :class="sideFirstPctParts(key, 'blue').deltaClass">
                    {{ sideFirstPctParts(key, 'blue').delta }}
                  </span>
                </td>
                <td class="py-1.5 pl-1 text-center">
                  {{ sideFirstPctParts(key, 'red').current }}
                  <span :class="sideFirstPctParts(key, 'red').deltaClass">
                    {{ sideFirstPctParts(key, 'red').delta }}
                  </span>
                </td>
              </tr>
              <template v-if="p.openObjectiveKeys.has(key)">
                <tr
                  v-for="count in p.objectiveCounts(key)"
                  :key="key + '-' + count"
                  class="bg-surface/30"
                >
                  <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                  <td class="px-1 py-1 text-center text-text/80">
                    <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                      {{ p.percentForCount(key, count, true) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                      {{ p.percentForCount(key, count, false) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ p.percentForCountSides(key, count, true) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="py-1 pl-1 text-center text-text/80">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ p.percentForCountSides(key, count, false) }}
                    </template>
                    <template v-else>—</template>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Drakes par type -->
      <div
        v-else-if="p.objectivesPanelTab === 'drakeTypes' && objectivesDisplayMode === 'obtention'"
        class="w-full min-w-0 overflow-x-auto"
      >
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByWin') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByLoss') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <template v-for="row in p.drakeTypeRows" :key="'drake-type-' + row.key">
              <tr>
                <td class="py-1.5 pr-2 font-medium text-text/90">
                  <button
                    type="button"
                    class="flex items-center gap-2 hover:text-text"
                    @click="toggleDrakeType(row.key)"
                  >
                    <span
                      class="inline-block transition-transform duration-200"
                      :class="openDrakeTypeKeys.has(row.key) ? 'rotate-180' : ''"
                      aria-hidden
                      >▼</span
                    >
                    <span
                      class="h-2.5 w-2.5 rounded-full"
                      :style="{ backgroundColor: rowColor(row.key) }"
                    />
                    <img
                      v-if="p.drakeIconSrc(row.key)"
                      :src="p.drakeIconSrc(row.key)"
                      :alt="row.label"
                      class="h-4 w-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      @error="p.onDrakeIconError($event, row.key)"
                    />
                    <span>{{ row.label }}</span>
                  </button>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ drakeTypePctParts(row.key, 'win').current }}
                    <span :class="drakeTypePctParts(row.key, 'win').deltaClass">
                      {{ drakeTypePctParts(row.key, 'win').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ drakeTypePctParts(row.key, 'loss').current }}
                    <span :class="drakeTypePctParts(row.key, 'loss').deltaClass">
                      {{ drakeTypePctParts(row.key, 'loss').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ drakeTypePctPartsSides(row.key, 'blue').current }}
                    <span :class="drakeTypePctPartsSides(row.key, 'blue').deltaClass">
                      {{ drakeTypePctPartsSides(row.key, 'blue').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="py-1.5 pl-1 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ drakeTypePctPartsSides(row.key, 'red').current }}
                    <span :class="drakeTypePctPartsSides(row.key, 'red').deltaClass">
                      {{ drakeTypePctPartsSides(row.key, 'red').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
              </tr>
              <template v-if="openDrakeTypeKeys.has(row.key)">
                <tr
                  v-for="count in p.drakeTypeCounts(row.key)"
                  :key="'drake-type-dist-' + row.key + '-' + count"
                  class="bg-surface/30"
                >
                  <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                  <td class="px-1 py-1 text-center text-text/80">
                    {{
                      p.overviewTeamsData && p.overviewTeamsData.matchCount > 0
                        ? p.drakeTypePercentForCount(row.key, count, true)
                        : '—'
                    }}
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    {{
                      p.overviewTeamsData && p.overviewTeamsData.matchCount > 0
                        ? p.drakeTypePercentForCount(row.key, count, false)
                        : '—'
                    }}
                  </td>
                  <td class="px-1 py-1 text-center text-text/80">
                    {{
                      p.overviewSidesData && p.overviewSidesData.matchCount > 0
                        ? p.drakeTypePercentForCountSides(row.key, count, true)
                        : '—'
                    }}
                  </td>
                  <td class="py-1 pl-1 text-center text-text/80">
                    {{
                      p.overviewSidesData && p.overviewSidesData.matchCount > 0
                        ? p.drakeTypePercentForCountSides(row.key, count, false)
                        : '—'
                    }}
                  </td>
                </tr>
                <tr v-if="p.drakeTypeCounts(row.key).length === 0" class="bg-surface/30">
                  <td class="py-1 pl-6 pr-2 text-text/70">—</td>
                  <td class="px-1 py-1 text-center text-text/80">—</td>
                  <td class="px-1 py-1 text-center text-text/80">—</td>
                  <td class="px-1 py-1 text-center text-text/80">—</td>
                  <td class="py-1 pl-1 text-center text-text/80">—</td>
                </tr>
              </template>
            </template>
            <tr v-if="p.drakeTypeRows.length === 0">
              <td colspan="5" class="py-2 text-center text-text/60">
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else-if="p.objectivesPanelTab === 'drakeTypes' && objectivesDisplayMode === 'winrate'"
        class="w-full min-w-0 overflow-x-auto"
      >
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.objectivesFirstWinrateColGlobal') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <tr v-for="row in drakeTypeWinrateRows" :key="'drake-type-wr-' + row.key">
              <td class="py-1.5 pr-2">
                <span class="inline-flex items-center gap-2 font-medium text-text/90">
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    :style="{ backgroundColor: rowColor(row.key) }"
                  />
                  <img
                    v-if="p.drakeIconSrc(row.key)"
                    :src="p.drakeIconSrc(row.key)"
                    :alt="row.label"
                    class="h-4 w-4 object-contain"
                    loading="lazy"
                    decoding="async"
                    @error="p.onDrakeIconError($event, row.key)"
                  />
                  <span>{{ row.label }}</span>
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ row.parts.current }}
                <span :class="row.parts.deltaClass">{{ row.parts.delta }}</span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ drakeTypeWinrateSideParts(row.key, 'blue').current }}
                <span :class="drakeTypeWinrateSideParts(row.key, 'blue').deltaClass">
                  {{ drakeTypeWinrateSideParts(row.key, 'blue').delta }}
                </span>
              </td>
              <td class="py-1.5 pl-1 text-center">
                {{ drakeTypeWinrateSideParts(row.key, 'red').current }}
                <span :class="drakeTypeWinrateSideParts(row.key, 'red').deltaClass">
                  {{ drakeTypeWinrateSideParts(row.key, 'red').delta }}
                </span>
              </td>
            </tr>
            <tr v-if="drakeTypeWinrateRows.length === 0">
              <td colspan="4" class="py-2 text-center text-text/60">
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Winrate quand first (global + par côté) -->
      <div
        v-else-if="p.objectivesPanelTab === 'objectives' && objectivesDisplayMode === 'winrate'"
        class="w-full min-w-0 overflow-x-auto"
      >
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.objectivesFirstWinrateColGlobal') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <tr v-for="wrKey in FIRST_WINRATE_KEYS" :key="'first-wr-' + wrKey">
              <td class="py-1.5 pr-2">
                <span class="inline-flex items-center gap-2 font-medium text-text/90">
                  <img
                    v-if="wrKey !== 'firstBlood' && p.objectiveIconSrc(wrKey)"
                    :src="p.objectiveIconSrc(wrKey)"
                    :alt="firstWinrateObjectiveLabel(wrKey)"
                    class="h-4 w-4 object-contain"
                    loading="lazy"
                    decoding="async"
                    @error="p.onObjectiveIconError($event, wrKey)"
                  />
                  {{ firstWinrateObjectiveLabel(wrKey) }}
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                  {{ objectiveFirstWinrateGlobalParts(wrKey).current }}
                  <span
                    v-if="objectiveFirstWinrateGlobalParts(wrKey).delta"
                    :class="objectiveFirstWinrateGlobalParts(wrKey).deltaClass"
                  >
                    {{ objectiveFirstWinrateGlobalParts(wrKey).delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ objectiveFirstWinrateSideParts(wrKey, 'blue').current }}
                  <span :class="objectiveFirstWinrateSideParts(wrKey, 'blue').deltaClass">
                    {{ objectiveFirstWinrateSideParts(wrKey, 'blue').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="py-1.5 pl-1 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ objectiveFirstWinrateSideParts(wrKey, 'red').current }}
                  <span :class="objectiveFirstWinrateSideParts(wrKey, 'red').deltaClass">
                    {{ objectiveFirstWinrateSideParts(wrKey, 'red').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Âmes -->
      <div
        v-else-if="p.objectivesPanelTab === 'drakeSouls' && objectivesDisplayMode === 'obtention'"
        class="w-full min-w-0 overflow-x-auto"
      >
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByWin') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.overviewTeamsByLoss') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <tr>
              <td class="py-1.5 pr-2 font-medium text-text/90">
                {{ p.t('statisticsPage.objectivesSoulGlobal') }}
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                  {{ soulGlobalPctParts('win').current }}
                  <span :class="soulGlobalPctParts('win').deltaClass">
                    {{ soulGlobalPctParts('win').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                  {{ soulGlobalPctParts('loss').current }}
                  <span :class="soulGlobalPctParts('loss').deltaClass">
                    {{ soulGlobalPctParts('loss').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ soulGlobalPctPartsSides('blue').current }}
                  <span :class="soulGlobalPctPartsSides('blue').deltaClass">
                    {{ soulGlobalPctPartsSides('blue').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="py-1.5 pl-1 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ soulGlobalPctPartsSides('red').current }}
                  <span :class="soulGlobalPctPartsSides('red').deltaClass">
                    {{ soulGlobalPctPartsSides('red').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
            </tr>
            <template v-for="row in p.drakeSoulRows" :key="'drake-soul-' + row.key">
              <tr>
                <td class="py-1.5 pr-2 font-medium text-text/90">
                  <div class="flex items-center gap-2">
                    <span
                      class="h-2.5 w-2.5 rounded-full"
                      :style="{ backgroundColor: rowColor(row.key) }"
                    />
                    <img
                      v-if="p.drakeIconSrc(row.key)"
                      :src="p.drakeIconSrc(row.key)"
                      :alt="row.label"
                      class="h-4 w-4 object-contain"
                      loading="lazy"
                      decoding="async"
                      @error="p.onDrakeIconError($event, row.key)"
                    />
                    <span>{{ row.label }}</span>
                  </div>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ drakeSoulPctParts(row.key, 'win').current }}
                    <span :class="drakeSoulPctParts(row.key, 'win').deltaClass">
                      {{ drakeSoulPctParts(row.key, 'win').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ drakeSoulPctParts(row.key, 'loss').current }}
                    <span :class="drakeSoulPctParts(row.key, 'loss').deltaClass">
                      {{ drakeSoulPctParts(row.key, 'loss').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ drakeSoulPctPartsSides(row.key, 'blue').current }}
                    <span :class="drakeSoulPctPartsSides(row.key, 'blue').deltaClass">
                      {{ drakeSoulPctPartsSides(row.key, 'blue').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="py-1.5 pl-1 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ drakeSoulPctPartsSides(row.key, 'red').current }}
                    <span :class="drakeSoulPctPartsSides(row.key, 'red').deltaClass">
                      {{ drakeSoulPctPartsSides(row.key, 'red').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
              </tr>
            </template>
            <tr v-if="p.drakeSoulRows.length === 0">
              <td colspan="5" class="py-2 text-center text-text/60">
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else-if="p.objectivesPanelTab === 'drakeSouls' && objectivesDisplayMode === 'winrate'"
        class="w-full min-w-0 overflow-x-auto"
      >
        <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr class="border-b border-primary/30 text-text/70">
              <th class="py-1.5 pr-2 font-medium">
                {{ p.t('statisticsPage.overviewTeamsObjective') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium">
                {{ p.t('statisticsPage.objectivesFirstWinrateColGlobal') }}
              </th>
              <th class="px-1 py-1.5 text-center font-medium text-blue-600 dark:text-blue-400">
                {{ p.t('statisticsPage.sidesBlue') }}
              </th>
              <th class="py-1.5 pl-1 text-center font-medium text-red-600 dark:text-red-400">
                {{ p.t('statisticsPage.sidesRed') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-primary/20 text-text/80">
            <tr>
              <td class="py-1.5 pr-2 font-medium text-text/90">
                {{ p.t('statisticsPage.objectivesSoulGlobal') }}
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                  {{ soulGlobalSecureWinrateParts().current }}
                  <span
                    v-if="soulGlobalSecureWinrateParts().deltaDisplay"
                    :class="soulGlobalSecureWinrateParts().deltaClass"
                  >
                    {{ soulGlobalSecureWinrateParts().deltaDisplay }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="px-1 py-1.5 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ soulGlobalSecureWinrateSideParts('blue').current }}
                  <span
                    v-if="soulGlobalSecureWinrateSideParts('blue').delta"
                    :class="soulGlobalSecureWinrateSideParts('blue').deltaClass"
                  >
                    {{ soulGlobalSecureWinrateSideParts('blue').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
              <td class="py-1.5 pl-1 text-center">
                <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                  {{ soulGlobalSecureWinrateSideParts('red').current }}
                  <span
                    v-if="soulGlobalSecureWinrateSideParts('red').delta"
                    :class="soulGlobalSecureWinrateSideParts('red').deltaClass"
                  >
                    {{ soulGlobalSecureWinrateSideParts('red').delta }}
                  </span>
                </template>
                <template v-else>—</template>
              </td>
            </tr>
            <tr v-for="row in drakeSoulWinrateRows" :key="'drake-soul-wr-' + row.key">
              <td class="py-1.5 pr-2">
                <span class="inline-flex items-center gap-2 font-medium text-text/90">
                  <span
                    class="h-2.5 w-2.5 rounded-full"
                    :style="{ backgroundColor: rowColor(row.key) }"
                  />
                  <img
                    v-if="p.drakeIconSrc(row.key)"
                    :src="p.drakeIconSrc(row.key)"
                    :alt="row.label"
                    class="h-4 w-4 object-contain"
                    loading="lazy"
                    decoding="async"
                    @error="p.onDrakeIconError($event, row.key)"
                  />
                  <span>{{ row.label }}</span>
                </span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ row.parts.current }}
                <span v-if="row.parts.deltaDisplay" :class="row.parts.deltaClass">{{
                  row.parts.deltaDisplay
                }}</span>
              </td>
              <td class="px-1 py-1.5 text-center">
                {{ soulSecureWinrateSideParts(row.key, 'blue').current }}
                <span
                  v-if="soulSecureWinrateSideParts(row.key, 'blue').delta"
                  :class="soulSecureWinrateSideParts(row.key, 'blue').deltaClass"
                >
                  {{ soulSecureWinrateSideParts(row.key, 'blue').delta }}
                </span>
              </td>
              <td class="py-1.5 pl-1 text-center">
                {{ soulSecureWinrateSideParts(row.key, 'red').current }}
                <span
                  v-if="soulSecureWinrateSideParts(row.key, 'red').delta"
                  :class="soulSecureWinrateSideParts(row.key, 'red').deltaClass"
                >
                  {{ soulSecureWinrateSideParts(row.key, 'red').delta }}
                </span>
              </td>
            </tr>
            <tr v-if="drakeSoulWinrateRows.length === 0">
              <td colspan="4" class="py-2 text-center text-text/60">
                {{ p.t('statisticsPage.noData') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showDistributionCards" class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div
        class="fast-stat-card mx-auto w-full max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <h4 class="mb-2 text-sm font-semibold text-text/90">
          {{ p.t('statisticsPage.objectivesDrakeDistributionCardTitle') }}
        </h4>
        <div v-if="drakeDistRows.length > 0" class="flex flex-col items-center gap-3">
          <div class="relative inline-flex h-[132px] w-[132px] items-center justify-center">
            <svg viewBox="0 0 120 120" class="absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                :stroke-width="DONUT_STROKE"
              />
              <circle
                v-for="(row, idx) in drakeDistRows"
                :key="'drake-donut-' + row.key"
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                :stroke="drakeDonutSegments[idx]?.color"
                :stroke-width="DONUT_STROKE"
                :stroke-dasharray="`${drakeDonutSegments[idx]?.arc ?? 0} ${DONUT_CIRCLE - (drakeDonutSegments[idx]?.arc ?? 0)}`"
                :stroke-dashoffset="`-${drakeDonutSegments[idx]?.offset ?? 0}`"
              >
                <title v-if="tooltipsEnabled">{{ donutTooltip(row, drakeDistTotal) }}</title>
              </circle>
            </svg>
            <span class="relative z-10 text-lg font-bold text-blue-600 dark:text-blue-300"
              >100%</span
            >
          </div>
          <ul class="grid w-full max-w-[360px] grid-cols-2 gap-x-3 gap-y-1 text-xs text-text/85">
            <li
              v-for="row in drakeDistRows"
              :key="'drake-dist-legend-' + row.key"
              class="flex items-center justify-between gap-2"
            >
              <span class="inline-flex min-w-0 items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: row.color }"
                />
                <span class="truncate">{{ row.label }}</span>
              </span>
              <span class="shrink-0 font-semibold">{{ distPct(row.value, drakeDistTotal) }}</span>
            </li>
          </ul>
        </div>
        <div v-else class="text-sm text-text/60">{{ p.t('statisticsPage.noData') }}</div>
      </div>

      <div
        class="fast-stat-card mx-auto w-full max-w-[420px] rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <h4 class="mb-2 text-sm font-semibold text-text/90">
          {{ p.t('statisticsPage.objectivesSoulDistributionCardTitle') }}
        </h4>
        <div v-if="soulDistRows.length > 0" class="flex flex-col items-center gap-3">
          <div class="relative inline-flex h-[132px] w-[132px] items-center justify-center">
            <svg viewBox="0 0 120 120" class="absolute inset-0 h-full w-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                :stroke-width="DONUT_STROKE"
              />
              <circle
                v-for="(row, idx) in soulDistRows"
                :key="'soul-donut-' + row.key"
                cx="60"
                cy="60"
                :r="DONUT_RADIUS"
                fill="none"
                :stroke="soulDonutSegments[idx]?.color"
                :stroke-width="DONUT_STROKE"
                :stroke-dasharray="`${soulDonutSegments[idx]?.arc ?? 0} ${DONUT_CIRCLE - (soulDonutSegments[idx]?.arc ?? 0)}`"
                :stroke-dashoffset="`-${soulDonutSegments[idx]?.offset ?? 0}`"
              >
                <title v-if="tooltipsEnabled">{{ donutTooltip(row, soulDistTotal) }}</title>
              </circle>
            </svg>
            <span class="relative z-10 text-lg font-bold text-blue-600 dark:text-blue-300"
              >100%</span
            >
          </div>
          <ul class="grid w-full max-w-[360px] grid-cols-2 gap-x-3 gap-y-1 text-xs text-text/85">
            <li
              v-for="row in soulDistRows"
              :key="'soul-dist-legend-' + row.key"
              class="flex items-center justify-between gap-2"
            >
              <span class="inline-flex min-w-0 items-center gap-2">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  :style="{ backgroundColor: row.color }"
                />
                <span class="truncate">{{ row.label }}</span>
              </span>
              <span class="shrink-0 font-semibold">{{ distPct(row.value, soulDistTotal) }}</span>
            </li>
          </ul>
        </div>
        <div v-else class="text-sm text-text/60">{{ p.t('statisticsPage.noData') }}</div>
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
