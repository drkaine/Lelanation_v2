<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import StatisticsObjectivesMobileCard, {
  type ObjectivesMobileMetric,
  type ObjectivesMobileSubRow,
} from '~/components/statistics/StatisticsObjectivesMobileCard.vue'

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
  const v = Math.min(100, Math.max(0, value))
  return `${v.toFixed(2)}%`
}

/** Limite un comptage d'obtention au nombre de matchs (évite affichage > 100 %). */
function cappedObtentionCount(raw: number, matchCount: number): number {
  const n = Number(raw) || 0
  if (n <= 0 || matchCount <= 0) return 0
  return Math.min(n, matchCount)
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
  return delta > 0 ? 'text-info' : 'text-error'
}

function teamFirstPctParts(
  objectiveKey: string,
  side: 'win' | 'loss'
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData || curData.matchCount <= 0)
    return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curObj = curData.objectives?.[objectiveKey] ?? {}
  const matchCount = Number(curData.matchCount)
  const rawCount = side === 'win' ? Number(curObj.firstByWin ?? 0) : Number(curObj.firstByLoss ?? 0)
  const curCount = cappedObtentionCount(rawCount, matchCount)
  const curPct = pct(curCount, matchCount)
  const baseData = p.overviewTeamsBaselineData
  const baseObj = baseData?.objectives?.[objectiveKey] ?? null
  const baseMatchCount = baseData ? Number(baseData.matchCount) : 0
  const baseRaw =
    baseObj == null
      ? null
      : side === 'win'
        ? Number(baseObj.firstByWin ?? 0)
        : Number(baseObj.firstByLoss ?? 0)
  const baseCount =
    baseRaw != null && baseMatchCount > 0 ? cappedObtentionCount(baseRaw, baseMatchCount) : null
  const basePct = baseMatchCount > 0 && baseCount != null ? pct(baseCount, baseMatchCount) : null
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
  const matchCount = Number(curData.matchCount)
  const rawCount =
    side === 'blue' ? Number(curObj.firstByBlue ?? 0) : Number(curObj.firstByRed ?? 0)
  const curCount = cappedObtentionCount(rawCount, matchCount)
  const curPct = pct(curCount, matchCount)
  const baseData = p.overviewSidesBaselineData
  const baseObj = baseData?.objectivesBySideTable?.[objectiveKey] ?? null
  const baseMatchCount = baseData ? Number(baseData.matchCount) : 0
  const baseRaw =
    baseObj == null
      ? null
      : side === 'blue'
        ? Number(baseObj.firstByBlue ?? 0)
        : Number(baseObj.firstByRed ?? 0)
  const baseCount =
    baseRaw != null && baseMatchCount > 0 ? cappedObtentionCount(baseRaw, baseMatchCount) : null
  const basePct = baseMatchCount > 0 && baseCount != null ? pct(baseCount, baseMatchCount) : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

/** Winrate borné à [0, 100] (évite affichage >100 % si données agrégées incohérentes). */
function clampSoulWinrate(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function formatFirstObjectiveWr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${clampSoulWinrate(value).toFixed(2)}%`
}

type WrParts = { current: string; delta: string; deltaClass: string }

function wrPartsFromValues(cur: number | null, base: number | null): WrParts {
  const curClamped = cur != null ? clampSoulWinrate(cur) : null
  const baseClamped = base != null ? clampSoulWinrate(base) : null
  const delta = curClamped != null && baseClamped != null ? curClamped - baseClamped : null
  return {
    current: formatFirstObjectiveWr(curClamped),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

/** WR parmi les matchs avec exactement `count` prises (win + loss dans l’histogramme). */
function winrateFromOutcomeDist(
  winDist: Record<string, number> | undefined,
  lossDist: Record<string, number> | undefined,
  count: number
): number | null {
  const w = Number(winDist?.[String(count)] ?? 0)
  const l = Number(lossDist?.[String(count)] ?? 0)
  const t = w + l
  if (t <= 0) return null
  return clampSoulWinrate((w / t) * 100)
}

function winrateFromSideBucket(
  games: Record<string, number> | undefined,
  wins: Record<string, number> | undefined,
  count: number
): number | null {
  const g = Number(games?.[String(count)] ?? 0)
  const w = Number(wins?.[String(count)] ?? 0)
  if (g <= 0) return null
  return clampSoulWinrate((w / g) * 100)
}

type SideDistributionRow = {
  distributionByBlue?: Record<string, number>
  distributionByRed?: Record<string, number>
  distributionWinsByBlue?: Record<string, number>
  distributionWinsByRed?: Record<string, number>
}

function sideTableRow(key: string): SideDistributionRow | null {
  const row = p.overviewSidesData?.objectivesBySideTable?.[key]
  return row && typeof row === 'object' ? (row as SideDistributionRow) : null
}

function sideTableRowBaseline(key: string): SideDistributionRow | null {
  const row = p.overviewSidesBaselineData?.objectivesBySideTable?.[key]
  return row && typeof row === 'object' ? (row as SideDistributionRow) : null
}

function drakeSideTypeRow(key: string): SideDistributionRow | null {
  return (
    (p.overviewSidesData?.drakesBySide?.types?.[key] as SideDistributionRow | undefined) ?? null
  )
}

function drakeSideTypeRowBaseline(key: string): SideDistributionRow | null {
  return (
    (p.overviewSidesBaselineData?.drakesBySide?.types?.[key] as SideDistributionRow | undefined) ??
    null
  )
}

const HORDE_HISTOGRAM_CAP = 3
const RIFT_HERALD_HISTOGRAM_CAP = 1

function aggregateObjectiveHistogramDist(
  key: string,
  dist: Record<string, number> | undefined
): Record<number, number> {
  const aggregated: Record<number, number> = {}
  if (!dist || typeof dist !== 'object') return aggregated
  for (const [k, n] of Object.entries(dist)) {
    let displayCount = parseInt(k, 10) || 0
    if (key === 'horde' && displayCount > HORDE_HISTOGRAM_CAP) displayCount = HORDE_HISTOGRAM_CAP
    else if (key === 'riftHerald' && displayCount > RIFT_HERALD_HISTOGRAM_CAP) {
      displayCount = RIFT_HERALD_HISTOGRAM_CAP
    }
    aggregated[displayCount] = (aggregated[displayCount] ?? 0) + Number(n)
  }
  return aggregated
}

function histogramCountPctParts(
  dist: Record<string, number> | undefined,
  baseDist: Record<string, number> | undefined,
  objectiveKey: string,
  count: number,
  curMatchCount: number,
  baseMatchCount: number
): { current: string; delta: string; deltaClass: string } {
  if (!curMatchCount) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curGames = aggregateObjectiveHistogramDist(objectiveKey, dist)[count] ?? 0
  const curPct = pct(curGames, curMatchCount)
  const baseGames =
    baseMatchCount > 0 && baseDist
      ? (aggregateObjectiveHistogramDist(objectiveKey, baseDist)[count] ?? 0)
      : null
  const basePct = baseMatchCount > 0 && baseGames != null ? pct(baseGames, baseMatchCount) : null
  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
    delta: formatDelta(delta),
    deltaClass: deltaColorClass(delta),
  }
}

function objectiveObtentionCountTeamParts(
  key: string,
  count: number,
  byWin: boolean
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData?.matchCount) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curObj = curData.objectives?.[key] as
    | { distributionByWin?: Record<string, number>; distributionByLoss?: Record<string, number> }
    | undefined
  if (!curObj) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const dist = byWin ? curObj.distributionByWin : curObj.distributionByLoss
  const baseObj = p.overviewTeamsBaselineData?.objectives?.[key] as typeof curObj
  const baseDist = baseObj
    ? byWin
      ? baseObj.distributionByWin
      : baseObj.distributionByLoss
    : undefined
  return histogramCountPctParts(
    dist,
    baseDist,
    key,
    count,
    Number(curData.matchCount),
    Number(p.overviewTeamsBaselineData?.matchCount ?? 0)
  )
}

function objectiveObtentionCountSideParts(
  key: string,
  count: number,
  byBlue: boolean
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewSidesData
  if (!curData?.matchCount) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curRow = sideTableRow(key)
  if (!curRow) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const dist = byBlue ? curRow.distributionByBlue : curRow.distributionByRed
  const baseRow = sideTableRowBaseline(key)
  const baseDist = baseRow
    ? byBlue
      ? baseRow.distributionByBlue
      : baseRow.distributionByRed
    : undefined
  return histogramCountPctParts(
    dist,
    baseDist,
    key,
    count,
    Number(curData.matchCount),
    Number(p.overviewSidesBaselineData?.matchCount ?? 0)
  )
}

function drakeTypeObtentionCountTeamParts(
  key: string,
  count: number,
  byWin: boolean
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewTeamsData
  if (!curData?.matchCount) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curRow = p.drakeTypeRows.find((r: { key: string }) => r.key === key) as
    | { distributionByWin?: Record<string, number>; distributionByLoss?: Record<string, number> }
    | undefined
  if (!curRow) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const dist = byWin ? curRow.distributionByWin : curRow.distributionByLoss
  const baseRow = p.overviewTeamsBaselineData?.drakes?.types?.[key] as typeof curRow
  const baseDist = baseRow
    ? byWin
      ? baseRow.distributionByWin
      : baseRow.distributionByLoss
    : undefined
  return histogramCountPctParts(
    dist,
    baseDist,
    key,
    count,
    Number(curData.matchCount),
    Number(p.overviewTeamsBaselineData?.matchCount ?? 0)
  )
}

function drakeTypeObtentionCountSideParts(
  key: string,
  count: number,
  byBlue: boolean
): { current: string; delta: string; deltaClass: string } {
  const curData = p.overviewSidesData
  if (!curData?.matchCount) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curRow = drakeSideTypeRow(key)
  if (!curRow) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const dist = byBlue ? curRow.distributionByBlue : curRow.distributionByRed
  const baseRow = drakeSideTypeRowBaseline(key)
  const baseDist = baseRow
    ? byBlue
      ? baseRow.distributionByBlue
      : baseRow.distributionByRed
    : undefined
  return histogramCountPctParts(
    dist,
    baseDist,
    key,
    count,
    Number(curData.matchCount),
    Number(p.overviewSidesBaselineData?.matchCount ?? 0)
  )
}

function objectiveWinrateCountGlobalParts(key: string, count: number): WrParts {
  const curObj = p.overviewTeamsData?.objectives?.[key] as
    | { distributionByWin?: Record<string, number>; distributionByLoss?: Record<string, number> }
    | undefined
  const baseObj = p.overviewTeamsBaselineData?.objectives?.[key] as typeof curObj
  const cur = winrateFromOutcomeDist(curObj?.distributionByWin, curObj?.distributionByLoss, count)
  const base = winrateFromOutcomeDist(
    baseObj?.distributionByWin,
    baseObj?.distributionByLoss,
    count
  )
  return wrPartsFromValues(cur, base)
}

function objectiveWinrateCountSideParts(key: string, count: number, side: 'blue' | 'red'): WrParts {
  const curRow = sideTableRow(key)
  const baseRow = sideTableRowBaseline(key)
  const games = side === 'blue' ? curRow?.distributionByBlue : curRow?.distributionByRed
  const wins = side === 'blue' ? curRow?.distributionWinsByBlue : curRow?.distributionWinsByRed
  const baseGames = side === 'blue' ? baseRow?.distributionByBlue : baseRow?.distributionByRed
  const baseWins =
    side === 'blue' ? baseRow?.distributionWinsByBlue : baseRow?.distributionWinsByRed
  const cur = winrateFromSideBucket(games, wins, count)
  const base = winrateFromSideBucket(baseGames, baseWins, count)
  return wrPartsFromValues(cur, base)
}

function drakeTypeWinrateCountGlobalParts(key: string, count: number): WrParts {
  const curRow = p.drakeTypeRows.find((r: { key: string }) => r.key === key)
  const baseRow = p.overviewTeamsBaselineData?.drakes?.types?.[key] as
    | { distributionByWin?: Record<string, number>; distributionByLoss?: Record<string, number> }
    | undefined
  const cur = winrateFromOutcomeDist(curRow?.distributionByWin, curRow?.distributionByLoss, count)
  const base = winrateFromOutcomeDist(
    baseRow?.distributionByWin,
    baseRow?.distributionByLoss,
    count
  )
  return wrPartsFromValues(cur, base)
}

function drakeTypeWinrateCountSideParts(key: string, count: number, side: 'blue' | 'red'): WrParts {
  const curRow = drakeSideTypeRow(key)
  const baseRow = drakeSideTypeRowBaseline(key)
  const games = side === 'blue' ? curRow?.distributionByBlue : curRow?.distributionByRed
  const wins = side === 'blue' ? curRow?.distributionWinsByBlue : curRow?.distributionWinsByRed
  const baseGames = side === 'blue' ? baseRow?.distributionByBlue : baseRow?.distributionByRed
  const baseWins =
    side === 'blue' ? baseRow?.distributionWinsByBlue : baseRow?.distributionWinsByRed
  const cur = winrateFromSideBucket(games, wins, count)
  const base = winrateFromSideBucket(baseGames, baseWins, count)
  return wrPartsFromValues(cur, base)
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

function objectiveFirstWinrateGlobalParts(key: string): WrParts {
  const cur =
    p.overviewTeamsData?.objectiveFirstWinrateGlobal?.[
      key as keyof typeof p.overviewTeamsData.objectiveFirstWinrateGlobal
    ] ?? null
  const base =
    p.overviewTeamsBaselineData?.objectiveFirstWinrateGlobal?.[
      key as keyof typeof p.overviewTeamsBaselineData.objectiveFirstWinrateGlobal
    ] ?? null
  return wrPartsFromValues(cur, base)
}

function objectiveFirstWinrateSideParts(key: string, side: 'blue' | 'red'): WrParts {
  const cur =
    p.overviewSidesData?.objectiveFirstWinrateBySide?.[
      key as keyof typeof p.overviewSidesData.objectiveFirstWinrateBySide
    ]?.[side] ?? null
  const base =
    p.overviewSidesBaselineData?.objectiveFirstWinrateBySide?.[
      key as keyof typeof p.overviewSidesBaselineData.objectiveFirstWinrateBySide
    ]?.[side] ?? null
  return wrPartsFromValues(cur, base)
}

function drakeTypeWinrateGlobalParts(key: string): WrParts {
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
  return wrPartsFromValues(curWr, baseWr)
}

function drakeTypeWinrateSideParts(key: string, side: 'blue' | 'red'): WrParts {
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
  return wrPartsFromValues(
    curV != null ? clampSoulWinrate(curV) : null,
    baseV != null ? clampSoulWinrate(baseV) : null
  )
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
    current: formatPct(curPct),
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
    current: formatPct(curPct),
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
  const matchCount = Number(curData.matchCount)
  const curCount = cappedObtentionCount(
    side === 'win' ? Number(curRow?.byWin ?? 0) : Number(curRow?.byLoss ?? 0),
    matchCount
  )
  if (curCount <= 0) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curPct = pct(curCount, matchCount)

  const baseData = p.overviewTeamsBaselineData
  const baseSoul = baseData?.drakes?.souls?.[key]
  const baseMatchCount = baseData ? Number(baseData.matchCount) : 0
  const baseRaw =
    baseSoul == null
      ? null
      : side === 'win'
        ? Number(baseSoul.byWin ?? 0)
        : Number(baseSoul.byLoss ?? 0)
  const baseCount =
    baseRaw != null && baseMatchCount > 0 ? cappedObtentionCount(baseRaw, baseMatchCount) : null
  const basePct = baseMatchCount > 0 && baseCount != null ? pct(baseCount, baseMatchCount) : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
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
  const matchCount = Number(curData.matchCount)
  const curCount = cappedObtentionCount(
    side === 'blue' ? Number(curSoul.byBlue ?? 0) : Number(curSoul.byRed ?? 0),
    matchCount
  )
  if (curCount <= 0) return { current: '—', delta: '', deltaClass: 'text-text/80' }
  const curPct = pct(curCount, matchCount)

  const baseData = p.overviewSidesBaselineData
  const baseSoul = baseData?.drakesBySide?.souls?.[key]
  const baseMatchCount = baseData ? Number(baseData.matchCount) : 0
  const baseRaw =
    baseSoul == null
      ? null
      : side === 'blue'
        ? Number(baseSoul.byBlue ?? 0)
        : Number(baseSoul.byRed ?? 0)
  const baseCount =
    baseRaw != null && baseMatchCount > 0 ? cappedObtentionCount(baseRaw, baseMatchCount) : null
  const basePct = baseMatchCount > 0 && baseCount != null ? pct(baseCount, baseMatchCount) : null

  const delta = curPct != null && basePct != null ? curPct - basePct : null
  return {
    current: formatPct(curPct),
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
    current: formatPct(curPct),
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
    current: formatPct(curPct),
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

const drakeSoulWinrateRows = computed(() =>
  (p.drakeSoulRows as Array<{ key: string; label: string; byWin: number; byLoss: number }>)
    .map(row => {
      const parts = soulSecureWinrateParts(row.key)
      return { ...row, parts, wr: parts.value ?? -1 }
    })
    .sort((a, b) => b.wr - a.wr)
)

const mobileColLabels = computed(() => ({
  firstWin: String(p.t('statisticsPage.overviewTeamsFirstByWin')),
  firstLoss: String(p.t('statisticsPage.overviewTeamsFirstByLoss')),
  byWin: String(p.t('statisticsPage.overviewTeamsByWin')),
  byLoss: String(p.t('statisticsPage.overviewTeamsByLoss')),
  blue: String(p.t('statisticsPage.sidesBlue')),
  red: String(p.t('statisticsPage.sidesRed')),
  globalWr: String(p.t('statisticsPage.objectivesFirstWinrateColGlobal')),
}))

function mobileMetric(
  label: string,
  parts: { current: string; delta: string; deltaClass: string }
): ObjectivesMobileMetric {
  return {
    label,
    current: parts.current,
    delta: parts.delta,
    deltaClass: parts.deltaClass,
  }
}

const mobileMainObtentionRows = computed(() => {
  const L = mobileColLabels.value
  const rows: Array<{
    id: string
    title: string
    iconSrc?: string | null
    expandable?: boolean
    expanded?: boolean
    metrics: ObjectivesMobileMetric[]
    subRows?: ObjectivesMobileSubRow[]
  }> = [
    {
      id: 'firstBlood',
      title: String(p.t('statisticsPage.overviewTeamsFirstBlood')),
      metrics: [
        mobileMetric(L.firstWin, teamFirstPctParts('firstBlood', 'win')),
        mobileMetric(L.firstLoss, teamFirstPctParts('firstBlood', 'loss')),
        mobileMetric(L.blue, sideFirstPctParts('firstBlood', 'blue')),
        mobileMetric(L.red, sideFirstPctParts('firstBlood', 'red')),
      ],
    },
  ]
  for (const key of p.objectiveKeysOrdered as string[]) {
    const hasDrop = Boolean(p.objectiveHasKillDropdown(key))
    const expanded = p.openObjectiveKeys.has(key)
    const subRows: ObjectivesMobileSubRow[] = []
    if (hasDrop && expanded) {
      for (const count of p.objectiveCounts(key) as number[]) {
        subRows.push({
          label: String(count),
          metrics: [
            mobileMetric(
              L.firstWin,
              p.overviewTeamsData?.matchCount > 0
                ? objectiveObtentionCountTeamParts(key, count, true)
                : { current: '—', delta: '', deltaClass: 'text-text/80' }
            ),
            mobileMetric(
              L.firstLoss,
              p.overviewTeamsData?.matchCount > 0
                ? objectiveObtentionCountTeamParts(key, count, false)
                : { current: '—', delta: '', deltaClass: 'text-text/80' }
            ),
            mobileMetric(
              L.blue,
              p.overviewSidesData?.matchCount > 0
                ? objectiveObtentionCountSideParts(key, count, true)
                : { current: '—', delta: '', deltaClass: 'text-text/80' }
            ),
            mobileMetric(
              L.red,
              p.overviewSidesData?.matchCount > 0
                ? objectiveObtentionCountSideParts(key, count, false)
                : { current: '—', delta: '', deltaClass: 'text-text/80' }
            ),
          ],
        })
      }
    }
    rows.push({
      id: key,
      title: String(p.t(`statisticsPage.overviewTeamsObjective_${key}`)),
      iconSrc: p.objectiveIconSrc(key) ?? null,
      expandable: hasDrop,
      expanded,
      metrics: [
        mobileMetric(L.firstWin, teamFirstPctParts(key, 'win')),
        mobileMetric(L.firstLoss, teamFirstPctParts(key, 'loss')),
        mobileMetric(L.blue, sideFirstPctParts(key, 'blue')),
        mobileMetric(L.red, sideFirstPctParts(key, 'red')),
      ],
      subRows: subRows.length > 0 ? subRows : undefined,
    })
  }
  return rows
})

const mobileMainWinrateRows = computed(() => {
  const L = mobileColLabels.value
  const rows: Array<{
    id: string
    title: string
    iconSrc?: string | null
    expandable?: boolean
    expanded?: boolean
    metrics: ObjectivesMobileMetric[]
    subRows?: ObjectivesMobileSubRow[]
  }> = [
    {
      id: 'firstBlood',
      title: String(p.t('statisticsPage.overviewTeamsFirstBlood')),
      metrics: [
        mobileMetric(L.globalWr, objectiveFirstWinrateGlobalParts('firstBlood')),
        mobileMetric(L.blue, objectiveFirstWinrateSideParts('firstBlood', 'blue')),
        mobileMetric(L.red, objectiveFirstWinrateSideParts('firstBlood', 'red')),
      ],
    },
  ]
  for (const key of p.objectiveKeysOrdered as string[]) {
    const hasDrop = Boolean(p.objectiveHasKillDropdown(key))
    const expanded = p.openObjectiveKeys.has(key)
    const subRows: ObjectivesMobileSubRow[] = []
    if (hasDrop && expanded) {
      for (const count of p.objectiveCounts(key) as number[]) {
        subRows.push({
          label: String(count),
          metrics: [
            mobileMetric(
              L.globalWr,
              p.overviewTeamsData?.matchCount > 0
                ? objectiveWinrateCountGlobalParts(key, count)
                : { current: '—', delta: '', deltaClass: 'text-text/80' }
            ),
            mobileMetric(
              L.blue,
              p.overviewSidesData?.matchCount > 0
                ? objectiveWinrateCountSideParts(key, count, 'blue')
                : { current: '—', delta: '', deltaClass: 'text-text/80' }
            ),
            mobileMetric(
              L.red,
              p.overviewSidesData?.matchCount > 0
                ? objectiveWinrateCountSideParts(key, count, 'red')
                : { current: '—', delta: '', deltaClass: 'text-text/80' }
            ),
          ],
        })
      }
    }
    rows.push({
      id: key,
      title: String(p.t(`statisticsPage.overviewTeamsObjective_${key}`)),
      iconSrc: p.objectiveIconSrc(key) ?? null,
      expandable: hasDrop,
      expanded,
      metrics: [
        mobileMetric(
          L.globalWr,
          p.overviewTeamsData?.matchCount > 0
            ? objectiveFirstWinrateGlobalParts(key)
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.blue,
          p.overviewSidesData?.matchCount > 0
            ? objectiveFirstWinrateSideParts(key, 'blue')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.red,
          p.overviewSidesData?.matchCount > 0
            ? objectiveFirstWinrateSideParts(key, 'red')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
      ],
      subRows: subRows.length > 0 ? subRows : undefined,
    })
  }
  return rows
})

function drakeTypeObtentionSubRows(key: string): ObjectivesMobileSubRow[] {
  if (!openDrakeTypeKeys.value.has(key)) return []
  const L = mobileColLabels.value
  const counts = p.drakeTypeCounts(key) as number[]
  if (counts.length === 0) return [{ label: '—', metrics: [] }]
  return counts.map((count: number) => ({
    label: String(count),
    metrics: [
      mobileMetric(
        L.byWin,
        p.overviewTeamsData?.matchCount > 0
          ? drakeTypeObtentionCountTeamParts(key, count, true)
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        L.byLoss,
        p.overviewTeamsData?.matchCount > 0
          ? drakeTypeObtentionCountTeamParts(key, count, false)
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        L.blue,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypeObtentionCountSideParts(key, count, true)
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        L.red,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypeObtentionCountSideParts(key, count, false)
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
    ],
  }))
}

const mobileDrakeTypeObtentionRows = computed(() =>
  (p.drakeTypeRows as Array<{ key: string; label: string }>).map(row => ({
    id: `drake-${row.key}`,
    key: row.key,
    title: row.label,
    iconSrc: p.drakeIconSrc(row.key) ?? null,
    color: rowColor(row.key),
    expandable: true,
    expanded: openDrakeTypeKeys.value.has(row.key),
    metrics: [
      mobileMetric(
        mobileColLabels.value.byWin,
        p.overviewTeamsData?.matchCount > 0
          ? drakeTypePctParts(row.key, 'win')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        mobileColLabels.value.byLoss,
        p.overviewTeamsData?.matchCount > 0
          ? drakeTypePctParts(row.key, 'loss')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        mobileColLabels.value.blue,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypePctPartsSides(row.key, 'blue')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        mobileColLabels.value.red,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypePctPartsSides(row.key, 'red')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
    ],
    subRows: drakeTypeObtentionSubRows(row.key),
  }))
)

function drakeTypeWinrateSubRows(key: string): ObjectivesMobileSubRow[] {
  if (!openDrakeTypeKeys.value.has(key)) return []
  const L = mobileColLabels.value
  const counts = p.drakeTypeCounts(key) as number[]
  if (counts.length === 0) return [{ label: '—', metrics: [] }]
  return counts.map((count: number) => ({
    label: String(count),
    metrics: [
      mobileMetric(
        L.globalWr,
        p.overviewTeamsData?.matchCount > 0
          ? drakeTypeWinrateCountGlobalParts(key, count)
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        L.blue,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypeWinrateCountSideParts(key, count, 'blue')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        L.red,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypeWinrateCountSideParts(key, count, 'red')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
    ],
  }))
}

const mobileDrakeTypeWinrateRows = computed(() =>
  (p.drakeTypeRows as Array<{ key: string; label: string }>).map(row => ({
    id: `drake-wr-${row.key}`,
    key: row.key,
    title: row.label,
    iconSrc: p.drakeIconSrc(row.key) ?? null,
    color: rowColor(row.key),
    expandable: true,
    expanded: openDrakeTypeKeys.value.has(row.key),
    metrics: [
      mobileMetric(
        mobileColLabels.value.globalWr,
        p.overviewTeamsData?.matchCount > 0
          ? drakeTypeWinrateGlobalParts(row.key)
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        mobileColLabels.value.blue,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypeWinrateSideParts(row.key, 'blue')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
      mobileMetric(
        mobileColLabels.value.red,
        p.overviewSidesData?.matchCount > 0
          ? drakeTypeWinrateSideParts(row.key, 'red')
          : { current: '—', delta: '', deltaClass: 'text-text/80' }
      ),
    ],
    subRows: drakeTypeWinrateSubRows(row.key),
  }))
)

const mobileSoulObtentionRows = computed(() => {
  const L = mobileColLabels.value
  const globalTitle = String(p.t('statisticsPage.objectivesSoulGlobal'))
  const rows = [
    {
      id: 'soul-global',
      title: globalTitle,
      metrics: [
        mobileMetric(
          L.byWin,
          p.overviewTeamsData?.matchCount > 0
            ? soulGlobalPctParts('win')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.byLoss,
          p.overviewTeamsData?.matchCount > 0
            ? soulGlobalPctParts('loss')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.blue,
          p.overviewSidesData?.matchCount > 0
            ? soulGlobalPctPartsSides('blue')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.red,
          p.overviewSidesData?.matchCount > 0
            ? soulGlobalPctPartsSides('red')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
      ],
    },
    ...(p.drakeSoulRows as Array<{ key: string; label: string }>).map(row => ({
      id: `soul-${row.key}`,
      title: row.label,
      iconSrc: p.drakeIconSrc(row.key) ?? null,
      color: rowColor(row.key),
      metrics: [
        mobileMetric(
          L.byWin,
          p.overviewTeamsData?.matchCount > 0
            ? drakeSoulPctParts(row.key, 'win')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.byLoss,
          p.overviewTeamsData?.matchCount > 0
            ? drakeSoulPctParts(row.key, 'loss')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.blue,
          p.overviewSidesData?.matchCount > 0
            ? drakeSoulPctPartsSides(row.key, 'blue')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.red,
          p.overviewSidesData?.matchCount > 0
            ? drakeSoulPctPartsSides(row.key, 'red')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
      ],
    })),
  ]
  return rows
})

const mobileSoulWinrateRows = computed(() => {
  const L = mobileColLabels.value
  const globalParts = soulGlobalSecureWinrateParts()
  const rows = [
    {
      id: 'soul-global-wr',
      title: String(p.t('statisticsPage.objectivesSoulGlobal')),
      metrics: [
        mobileMetric(
          L.globalWr,
          p.overviewTeamsData?.matchCount > 0
            ? globalParts
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.blue,
          p.overviewSidesData?.matchCount > 0
            ? soulGlobalSecureWinrateSideParts('blue')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
        mobileMetric(
          L.red,
          p.overviewSidesData?.matchCount > 0
            ? soulGlobalSecureWinrateSideParts('red')
            : { current: '—', delta: '', deltaClass: 'text-text/80' }
        ),
      ],
    },
    ...drakeSoulWinrateRows.value.map(row => ({
      id: `soul-wr-${row.key}`,
      title: row.label,
      iconSrc: p.drakeIconSrc(row.key) ?? null,
      color: rowColor(row.key),
      metrics: [
        mobileMetric(L.globalWr, {
          current: row.parts.current,
          delta: row.parts.deltaDisplay || row.parts.delta || '',
          deltaClass: row.parts.deltaClass,
        }),
        mobileMetric(L.blue, soulSecureWinrateSideParts(row.key, 'blue')),
        mobileMetric(L.red, soulSecureWinrateSideParts(row.key, 'red')),
      ],
    })),
  ]
  return rows
})

function onMobileObjectiveToggle(id: string) {
  if (id === 'firstBlood' || !p.objectiveHasKillDropdown(id)) return
  syncToggleObjective(id)
}

function drakeDropdownCountLabel(count: number): string {
  return String(p.t('statisticsPage.objectivesDrakeCountLabel', { count }))
}
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
      class="statistics-empty-panel p-4"
    >
      {{ p.t('statisticsPage.objectivesCombinedEmpty') }}
    </div>

    <div
      v-else
      class="fast-stat-card fast-stat-card-objectives ui-build-card-surface w-full max-w-full rounded-xl p-3"
    >
      <div class="mb-3 flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          class="shrink-0 text-base leading-none transition-colors"
          :class="
            p.cardIsFavorite('overview.objectives')
              ? 'text-text-accent hover:text-accent-light'
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
            class="fast-stat-tooltip-popover fast-stat-tooltip-popover--objectives fast-stat-tooltip-popover--end hidden group-hover/stat-tip:block"
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
        class="w-full min-w-0"
      >
        <div class="statistics-objectives-mobile-list space-y-3 md:hidden">
          <StatisticsObjectivesMobileCard
            v-for="row in mobileMainObtentionRows"
            :key="'mob-main-obt-' + row.id"
            :title="row.title"
            :icon-src="row.iconSrc"
            :expandable="row.expandable"
            :expanded="row.expanded"
            :metrics="row.metrics"
            :sub-rows="row.subRows"
            @toggle="onMobileObjectiveToggle(row.id)"
          />
        </div>
        <div class="hidden min-w-0 overflow-x-auto md:block">
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
                <th class="px-1 py-1.5 text-center font-medium text-info">
                  {{ p.t('statisticsPage.sidesBlue') }}
                </th>
                <th class="py-1.5 pl-1 text-center font-medium text-error">
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
              <template v-for="key in p.objectiveKeysOrdered" :key="key">
                <tr>
                  <td class="py-1.5 pr-2">
                    <button
                      v-if="p.objectiveHasKillDropdown(key)"
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
                    <div v-else class="flex items-center gap-1 font-medium text-text/90">
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
                    </div>
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
                <template v-if="p.objectiveHasKillDropdown(key) && p.openObjectiveKeys.has(key)">
                  <tr
                    v-for="count in p.objectiveCounts(key)"
                    :key="key + '-' + count"
                    class="bg-surface/30"
                  >
                    <td class="py-1 pl-6 pr-2 text-text/70">
                      {{ drakeDropdownCountLabel(count) }}
                    </td>
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
      </div>

      <!-- Drakes par type -->
      <div
        v-else-if="p.objectivesPanelTab === 'drakeTypes' && objectivesDisplayMode === 'obtention'"
        class="w-full min-w-0"
      >
        <div class="statistics-objectives-mobile-list space-y-3 md:hidden">
          <StatisticsObjectivesMobileCard
            v-for="row in mobileDrakeTypeObtentionRows"
            :key="'mob-drake-obt-' + row.id"
            :title="row.title"
            :icon-src="row.iconSrc"
            :color="row.color"
            expandable
            :expanded="row.expanded"
            :metrics="row.metrics"
            :sub-rows="row.subRows"
            @toggle="toggleDrakeType(row.key)"
          />
          <p
            v-if="mobileDrakeTypeObtentionRows.length === 0"
            class="py-2 text-center text-sm text-text/60"
          >
            {{ p.t('statisticsPage.noData') }}
          </p>
        </div>
        <div class="hidden min-w-0 overflow-x-auto md:block">
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
                <th class="px-1 py-1.5 text-center font-medium text-info">
                  {{ p.t('statisticsPage.sidesBlue') }}
                </th>
                <th class="py-1.5 pl-1 text-center font-medium text-error">
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
                    <td class="py-1 pl-6 pr-2 text-text/70">
                      {{ drakeDropdownCountLabel(count) }}
                    </td>
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
      </div>

      <div
        v-else-if="p.objectivesPanelTab === 'drakeTypes' && objectivesDisplayMode === 'winrate'"
        class="w-full min-w-0"
      >
        <div class="statistics-objectives-mobile-list space-y-3 md:hidden">
          <StatisticsObjectivesMobileCard
            v-for="row in mobileDrakeTypeWinrateRows"
            :key="'mob-drake-wr-' + row.id"
            :title="row.title"
            :icon-src="row.iconSrc"
            :color="row.color"
            expandable
            :expanded="row.expanded"
            :metrics="row.metrics"
            :sub-rows="row.subRows"
            @toggle="toggleDrakeType(row.key)"
          />
          <p
            v-if="mobileDrakeTypeWinrateRows.length === 0"
            class="py-2 text-center text-sm text-text/60"
          >
            {{ p.t('statisticsPage.noData') }}
          </p>
        </div>
        <div class="hidden min-w-0 overflow-x-auto md:block">
          <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr class="border-b border-primary/30 text-text/70">
                <th class="py-1.5 pr-2 font-medium">
                  {{ p.t('statisticsPage.overviewTeamsObjective') }}
                </th>
                <th class="px-1 py-1.5 text-center font-medium">
                  {{ p.t('statisticsPage.objectivesFirstWinrateColGlobal') }}
                </th>
                <th class="px-1 py-1.5 text-center font-medium text-info">
                  {{ p.t('statisticsPage.sidesBlue') }}
                </th>
                <th class="py-1.5 pl-1 text-center font-medium text-error">
                  {{ p.t('statisticsPage.sidesRed') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20 text-text/80">
              <template v-for="row in p.drakeTypeRows" :key="'drake-type-wr-' + row.key">
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
                      {{ drakeTypeWinrateGlobalParts(row.key).current }}
                      <span :class="drakeTypeWinrateGlobalParts(row.key).deltaClass">
                        {{ drakeTypeWinrateGlobalParts(row.key).delta }}
                      </span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-1 py-1.5 text-center">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ drakeTypeWinrateSideParts(row.key, 'blue').current }}
                      <span :class="drakeTypeWinrateSideParts(row.key, 'blue').deltaClass">
                        {{ drakeTypeWinrateSideParts(row.key, 'blue').delta }}
                      </span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="py-1.5 pl-1 text-center">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ drakeTypeWinrateSideParts(row.key, 'red').current }}
                      <span :class="drakeTypeWinrateSideParts(row.key, 'red').deltaClass">
                        {{ drakeTypeWinrateSideParts(row.key, 'red').delta }}
                      </span>
                    </template>
                    <template v-else>—</template>
                  </td>
                </tr>
                <template v-if="openDrakeTypeKeys.has(row.key)">
                  <tr
                    v-for="count in p.drakeTypeCounts(row.key)"
                    :key="'drake-type-wr-dist-' + row.key + '-' + count"
                    class="bg-surface/30"
                  >
                    <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                    <td class="px-1 py-1 text-center text-text/80">
                      <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                        {{ drakeTypeWinrateCountGlobalParts(row.key, count).current }}
                        <span :class="drakeTypeWinrateCountGlobalParts(row.key, count).deltaClass">
                          {{ drakeTypeWinrateCountGlobalParts(row.key, count).delta }}
                        </span>
                      </template>
                      <template v-else>—</template>
                    </td>
                    <td class="px-1 py-1 text-center text-text/80">
                      <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                        {{ drakeTypeWinrateCountSideParts(row.key, count, 'blue').current }}
                        <span
                          :class="drakeTypeWinrateCountSideParts(row.key, count, 'blue').deltaClass"
                        >
                          {{ drakeTypeWinrateCountSideParts(row.key, count, 'blue').delta }}
                        </span>
                      </template>
                      <template v-else>—</template>
                    </td>
                    <td class="py-1 pl-1 text-center text-text/80">
                      <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                        {{ drakeTypeWinrateCountSideParts(row.key, count, 'red').current }}
                        <span
                          :class="drakeTypeWinrateCountSideParts(row.key, count, 'red').deltaClass"
                        >
                          {{ drakeTypeWinrateCountSideParts(row.key, count, 'red').delta }}
                        </span>
                      </template>
                      <template v-else>—</template>
                    </td>
                  </tr>
                  <tr v-if="p.drakeTypeCounts(row.key).length === 0" class="bg-surface/30">
                    <td class="py-1 pl-6 pr-2 text-text/70">—</td>
                    <td class="px-1 py-1 text-center text-text/80">—</td>
                    <td class="px-1 py-1 text-center text-text/80">—</td>
                    <td class="py-1 pl-1 text-center text-text/80">—</td>
                  </tr>
                </template>
              </template>
              <tr v-if="p.drakeTypeRows.length === 0">
                <td colspan="4" class="py-2 text-center text-text/60">
                  {{ p.t('statisticsPage.noData') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Winrate quand first (global + par côté) -->
      <div
        v-else-if="p.objectivesPanelTab === 'objectives' && objectivesDisplayMode === 'winrate'"
        class="w-full min-w-0"
      >
        <div class="statistics-objectives-mobile-list space-y-3 md:hidden">
          <StatisticsObjectivesMobileCard
            v-for="row in mobileMainWinrateRows"
            :key="'mob-main-wr-' + row.id"
            :title="row.title"
            :icon-src="row.iconSrc"
            :expandable="row.expandable"
            :expanded="row.expanded"
            :metrics="row.metrics"
            :sub-rows="row.subRows"
            @toggle="onMobileObjectiveToggle(row.id)"
          />
        </div>
        <div class="hidden min-w-0 overflow-x-auto md:block">
          <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr class="border-b border-primary/30 text-text/70">
                <th class="py-1.5 pr-2 font-medium">
                  {{ p.t('statisticsPage.overviewTeamsObjective') }}
                </th>
                <th class="px-1 py-1.5 text-center font-medium">
                  {{ p.t('statisticsPage.objectivesFirstWinrateColGlobal') }}
                </th>
                <th class="px-1 py-1.5 text-center font-medium text-info">
                  {{ p.t('statisticsPage.sidesBlue') }}
                </th>
                <th class="py-1.5 pl-1 text-center font-medium text-error">
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
                  <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                    {{ objectiveFirstWinrateGlobalParts('firstBlood').current }}
                    <span :class="objectiveFirstWinrateGlobalParts('firstBlood').deltaClass">
                      {{ objectiveFirstWinrateGlobalParts('firstBlood').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="px-1 py-1.5 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ objectiveFirstWinrateSideParts('firstBlood', 'blue').current }}
                    <span :class="objectiveFirstWinrateSideParts('firstBlood', 'blue').deltaClass">
                      {{ objectiveFirstWinrateSideParts('firstBlood', 'blue').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
                <td class="py-1.5 pl-1 text-center">
                  <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                    {{ objectiveFirstWinrateSideParts('firstBlood', 'red').current }}
                    <span :class="objectiveFirstWinrateSideParts('firstBlood', 'red').deltaClass">
                      {{ objectiveFirstWinrateSideParts('firstBlood', 'red').delta }}
                    </span>
                  </template>
                  <template v-else>—</template>
                </td>
              </tr>
              <template v-for="key in p.objectiveKeysOrdered" :key="'first-wr-' + key">
                <tr>
                  <td class="py-1.5 pr-2">
                    <button
                      v-if="p.objectiveHasKillDropdown(key)"
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
                    <div v-else class="flex items-center gap-1 font-medium text-text/90">
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
                    </div>
                  </td>
                  <td class="px-1 py-1.5 text-center">
                    <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                      {{ objectiveFirstWinrateGlobalParts(key).current }}
                      <span :class="objectiveFirstWinrateGlobalParts(key).deltaClass">
                        {{ objectiveFirstWinrateGlobalParts(key).delta }}
                      </span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="px-1 py-1.5 text-center">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ objectiveFirstWinrateSideParts(key, 'blue').current }}
                      <span :class="objectiveFirstWinrateSideParts(key, 'blue').deltaClass">
                        {{ objectiveFirstWinrateSideParts(key, 'blue').delta }}
                      </span>
                    </template>
                    <template v-else>—</template>
                  </td>
                  <td class="py-1.5 pl-1 text-center">
                    <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                      {{ objectiveFirstWinrateSideParts(key, 'red').current }}
                      <span :class="objectiveFirstWinrateSideParts(key, 'red').deltaClass">
                        {{ objectiveFirstWinrateSideParts(key, 'red').delta }}
                      </span>
                    </template>
                    <template v-else>—</template>
                  </td>
                </tr>
                <template v-if="p.objectiveHasKillDropdown(key) && p.openObjectiveKeys.has(key)">
                  <tr
                    v-for="count in p.objectiveCounts(key)"
                    :key="key + '-wr-' + count"
                    class="bg-surface/30"
                  >
                    <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                    <td class="px-1 py-1 text-center text-text/80">
                      <template v-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0">
                        {{ objectiveWinrateCountGlobalParts(key, count).current }}
                        <span :class="objectiveWinrateCountGlobalParts(key, count).deltaClass">
                          {{ objectiveWinrateCountGlobalParts(key, count).delta }}
                        </span>
                      </template>
                      <template v-else>—</template>
                    </td>
                    <td class="px-1 py-1 text-center text-text/80">
                      <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                        {{ objectiveWinrateCountSideParts(key, count, 'blue').current }}
                        <span
                          :class="objectiveWinrateCountSideParts(key, count, 'blue').deltaClass"
                        >
                          {{ objectiveWinrateCountSideParts(key, count, 'blue').delta }}
                        </span>
                      </template>
                      <template v-else>—</template>
                    </td>
                    <td class="py-1 pl-1 text-center text-text/80">
                      <template v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0">
                        {{ objectiveWinrateCountSideParts(key, count, 'red').current }}
                        <span :class="objectiveWinrateCountSideParts(key, count, 'red').deltaClass">
                          {{ objectiveWinrateCountSideParts(key, count, 'red').delta }}
                        </span>
                      </template>
                      <template v-else>—</template>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Âmes -->
      <div
        v-else-if="p.objectivesPanelTab === 'drakeSouls' && objectivesDisplayMode === 'obtention'"
        class="w-full min-w-0"
      >
        <div class="statistics-objectives-mobile-list space-y-3 md:hidden">
          <StatisticsObjectivesMobileCard
            v-for="row in mobileSoulObtentionRows"
            :key="'mob-soul-obt-' + row.id"
            :title="row.title"
            :icon-src="row.iconSrc"
            :color="row.color"
            :metrics="row.metrics"
          />
          <p
            v-if="mobileSoulObtentionRows.length === 0"
            class="py-2 text-center text-sm text-text/60"
          >
            {{ p.t('statisticsPage.noData') }}
          </p>
        </div>
        <div class="hidden min-w-0 overflow-x-auto md:block">
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
                <th class="px-1 py-1.5 text-center font-medium text-info">
                  {{ p.t('statisticsPage.sidesBlue') }}
                </th>
                <th class="py-1.5 pl-1 text-center font-medium text-error">
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
      </div>

      <div
        v-else-if="p.objectivesPanelTab === 'drakeSouls' && objectivesDisplayMode === 'winrate'"
        class="w-full min-w-0"
      >
        <div class="statistics-objectives-mobile-list space-y-3 md:hidden">
          <StatisticsObjectivesMobileCard
            v-for="row in mobileSoulWinrateRows"
            :key="'mob-soul-wr-' + row.id"
            :title="row.title"
            :icon-src="row.iconSrc"
            :color="row.color"
            :metrics="row.metrics"
          />
          <p
            v-if="mobileSoulWinrateRows.length === 0"
            class="py-2 text-center text-sm text-text/60"
          >
            {{ p.t('statisticsPage.noData') }}
          </p>
        </div>
        <div class="hidden min-w-0 overflow-x-auto md:block">
          <table class="objectives-zebra-cols w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr class="border-b border-primary/30 text-text/70">
                <th class="py-1.5 pr-2 font-medium">
                  {{ p.t('statisticsPage.overviewTeamsObjective') }}
                </th>
                <th class="px-1 py-1.5 text-center font-medium">
                  {{ p.t('statisticsPage.objectivesFirstWinrateColGlobal') }}
                </th>
                <th class="px-1 py-1.5 text-center font-medium text-info">
                  {{ p.t('statisticsPage.sidesBlue') }}
                </th>
                <th class="py-1.5 pl-1 text-center font-medium text-error">
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
    </div>

    <div v-if="showDistributionCards" class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div
        class="fast-stat-card fast-stat-card-distribution ui-build-card-surface mx-auto w-full max-w-[420px] rounded-xl p-3 md:mx-0"
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
            <span class="relative z-10 text-lg font-bold text-info dark:text-primary-light"
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
        class="fast-stat-card fast-stat-card-distribution ui-build-card-surface mx-auto w-full max-w-[420px] rounded-xl p-3 md:mx-0"
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
            <span class="relative z-10 text-lg font-bold text-info dark:text-primary-light"
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
