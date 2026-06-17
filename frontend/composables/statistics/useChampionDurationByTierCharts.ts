import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { DailyTrendSnapshotPoint } from '~/composables/statistics/useStatisticsDailyTrendCharts'
import {
  DAILY_TREND_CHART_H,
  DAILY_TREND_CHART_PAD,
  DAILY_TREND_CHART_W,
  DAILY_TREND_PLOT_H,
  DAILY_TREND_PLOT_W,
} from '~/composables/statistics/useStatisticsDailyTrendCharts'

const RANK_TIERS = [
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
] as const

const RANK_COLOR_MAP: Record<string, string> = {
  IRON: '#6b7280',
  BRONZE: '#92400e',
  SILVER: '#94a3b8',
  GOLD: '#a16207',
  PLATINUM: '#0f766e',
  EMERALD: '#166534',
  DIAMOND: '#1d4ed8',
  MASTER: '#6d28d9',
  GRANDMASTER: '#991b1b',
  CHALLENGER: '#9a3412',
  GLOBAL: '#c084fc',
}

export type ChampionDurationByTierData = {
  series: Array<{
    rankTier: string
    buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
  }>
}

type DurationChartMode = 'winrate' | 'games'

type DurationSeriesPoint = {
  idx: number
  x: number
  y: number
  value: number
  bucketLabel: string
  games?: number
}

export type DurationTrendChartCard = {
  metricId: 'winrate' | 'games'
  title: string
  series: Array<{
    tier: string
    color: string
    path: string
    points: DurationSeriesPoint[]
  }>
  xTicks: Array<{ index: number; x: number; label: string }>
  yTicks: Array<{ value: number; y: number; label: string }>
}

function normalizeRankTier(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .split('_')[0]!
  if (!normalized || normalized === 'UNRANKED') return ''
  return normalized
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1)
    return `M ${points[0]!.x},${points[0]!.y} L ${points[0]!.x + 0.1},${points[0]!.y}`
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')
}

function smoothSeries(values: number[], window = 3): number[] {
  if (values.length <= 2) return values
  const w = Math.max(1, window | 0)
  return values.map((_, idx) => {
    const from = Math.max(0, idx - (w - 1))
    const slice = values.slice(from, idx + 1)
    const sum = slice.reduce((acc, v) => acc + v, 0)
    return slice.length ? sum / slice.length : values[idx]!
  })
}

export function useChampionDurationByTierCharts(options: {
  durationData: Ref<ChampionDurationByTierData | null>
  trendPoints: Ref<DailyTrendSnapshotPoint[]>
  filterRank: Ref<string[]>
  showGlobalLine: Ref<boolean>
  winrateTitle: ComputedRef<string>
  gamesTitle: ComputedRef<string>
}) {
  const hiddenLegendTiers = ref<string[]>([])

  function isLegendTierVisible(tier: string): boolean {
    return !hiddenLegendTiers.value.includes(String(tier))
  }

  function toggleLegendTierVisibility(tier: string): void {
    const key = String(tier)
    if (!key) return
    if (hiddenLegendTiers.value.includes(key)) {
      hiddenLegendTiers.value = hiddenLegendTiers.value.filter(t => t !== key)
      return
    }
    hiddenLegendTiers.value = [...hiddenLegendTiers.value, key]
  }

  const durationDisplayTiers = computed(() => {
    const selected = Array.from(new Set(options.filterRank.value.map(normalizeRankTier))).filter(
      Boolean
    )
    if (selected.length) return selected
    const fromTrend = Array.from(
      new Set(options.trendPoints.value.map(p => normalizeRankTier(p.rankTier)))
    ).filter(Boolean)
    if (fromTrend.length) {
      return fromTrend.sort(
        (a, b) =>
          (!RANK_TIERS.includes(a as (typeof RANK_TIERS)[number])
            ? 999
            : RANK_TIERS.indexOf(a as (typeof RANK_TIERS)[number])) -
          (!RANK_TIERS.includes(b as (typeof RANK_TIERS)[number])
            ? 999
            : RANK_TIERS.indexOf(b as (typeof RANK_TIERS)[number]))
      )
    }
    const fromApi =
      options.durationData.value?.series?.map(s => normalizeRankTier(s.rankTier)).filter(Boolean) ??
      []
    const uniq = [...new Set(fromApi)]
    return uniq.sort(
      (a, b) =>
        (!RANK_TIERS.includes(a as (typeof RANK_TIERS)[number])
          ? 999
          : RANK_TIERS.indexOf(a as (typeof RANK_TIERS)[number])) -
        (!RANK_TIERS.includes(b as (typeof RANK_TIERS)[number])
          ? 999
          : RANK_TIERS.indexOf(b as (typeof RANK_TIERS)[number]))
    )
  })

  function buildDurationByTierChart(mode: DurationChartMode): DurationTrendChartCard | null {
    const seriesRaw = options.durationData.value?.series ?? []
    const tiers = durationDisplayTiers.value
    if (!tiers.length) return null

    const tierBucketMap = new Map<
      string,
      Map<number, { winrate: number; games: number; wins: number }>
    >()
    for (const s of seriesRaw) {
      const tier = normalizeRankTier(s.rankTier)
      if (!tier) continue
      let m = tierBucketMap.get(tier)
      if (!m) {
        m = new Map()
        tierBucketMap.set(tier, m)
      }
      for (const b of s.buckets) {
        const prev = m.get(b.durationMin) ?? { winrate: 0, games: 0, wins: 0 }
        const games = prev.games + b.matchCount
        const wins = prev.wins + b.wins
        m.set(b.durationMin, {
          games,
          wins,
          winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
        })
      }
    }

    const durSet = new Set<number>()
    for (const m of tierBucketMap.values()) {
      for (const d of m.keys()) durSet.add(d)
    }
    if (!durSet.size) return null

    const maxDur = Math.max(...durSet)
    const durationAxisMinutes = new Set<number>([0])
    for (let d = 5; d <= maxDur; d += 5) durationAxisMinutes.add(d)
    for (const d of durSet) durationAxisMinutes.add(d)
    const fullDurations = [...durationAxisMinutes].sort((a, b) => a - b)

    const n = fullDurations.length
    const xAt = (index: number) =>
      DAILY_TREND_CHART_PAD.left + (n <= 1 ? 0 : index / (n - 1)) * DAILY_TREND_PLOT_W

    const tiersOrdered = [...tiers].sort(
      (a, b) =>
        (!RANK_TIERS.includes(a as (typeof RANK_TIERS)[number])
          ? 999
          : RANK_TIERS.indexOf(a as (typeof RANK_TIERS)[number])) -
        (!RANK_TIERS.includes(b as (typeof RANK_TIERS)[number])
          ? 999
          : RANK_TIERS.indexOf(b as (typeof RANK_TIERS)[number]))
    )

    type DurPendingSerie = {
      tier: string
      color: string
      rawValues: Array<{ idx: number; value: number; bucketLabel: string; games: number }>
    }

    function buildDenseRowForTier(tier: string): {
      rawValues: DurPendingSerie['rawValues']
      hasData: boolean
    } {
      const m = tierBucketMap.get(tier)
      const rawValues: DurPendingSerie['rawValues'] = []
      let hasData = false
      fullDurations.forEach((durMin, index) => {
        const defaultLabel = `${durMin}–${durMin + 5} min`
        if (index === 0) {
          rawValues.push({ idx: index, value: 0, bucketLabel: defaultLabel, games: 0 })
          return
        }
        let cell = m?.get(durMin)
        let bucketLabel = defaultLabel
        if ((!cell || cell.games <= 0) && durMin === 5) {
          const b0 = m?.get(0)
          if (b0 && b0.games > 0) {
            cell = b0
            bucketLabel = `0–5 min`
          }
        }
        if (!cell || cell.games <= 0) {
          rawValues.push({ idx: index, value: 0, bucketLabel: defaultLabel, games: 0 })
          return
        }
        hasData = true
        const value = mode === 'winrate' ? cell.winrate : cell.games
        rawValues.push({ idx: index, value, bucketLabel, games: cell.games })
      })
      return { rawValues, hasData }
    }

    const pendingSeries: DurPendingSerie[] = tiersOrdered
      .map(tier => {
        const { rawValues, hasData } = buildDenseRowForTier(tier)
        if (!hasData) return null
        return {
          tier,
          color: RANK_COLOR_MAP[tier] ?? '#64748b',
          rawValues,
        }
      })
      .filter((s): s is DurPendingSerie => s !== null)

    if (options.showGlobalLine.value) {
      const rawValues: DurPendingSerie['rawValues'] = []
      let hasData = false
      fullDurations.forEach((durMin, idx) => {
        const bucketLabel = `${durMin}–${durMin + 5} min`
        if (idx === 0) {
          rawValues.push({ idx, value: 0, bucketLabel, games: 0 })
          return
        }
        if (mode === 'winrate') {
          let tw = 0
          let tg = 0
          for (const map of tierBucketMap.values()) {
            const c = map.get(durMin)
            if (c && c.games > 0) {
              tw += c.wins
              tg += c.games
            }
          }
          let label = bucketLabel
          if (tg === 0 && durMin === 5) {
            let tw0 = 0
            let tg0 = 0
            for (const map of tierBucketMap.values()) {
              const c = map.get(0)
              if (c && c.games > 0) {
                tw0 += c.wins
                tg0 += c.games
              }
            }
            if (tg0 > 0) {
              tw = tw0
              tg = tg0
              label = `0–5 min`
            }
          }
          if (tg > 0) hasData = true
          const value = tg > 0 ? (100 * tw) / tg : 0
          rawValues.push({ idx, value, bucketLabel: label, games: tg })
        } else {
          let tg = 0
          for (const map of tierBucketMap.values()) {
            const c = map.get(durMin)
            if (c && c.games > 0) tg += c.games
          }
          let label = bucketLabel
          if (tg === 0 && durMin === 5) {
            let tg0 = 0
            for (const map of tierBucketMap.values()) {
              const c = map.get(0)
              if (c && c.games > 0) tg0 += c.games
            }
            if (tg0 > 0) {
              tg = tg0
              label = `0–5 min`
            }
          }
          if (tg > 0) hasData = true
          rawValues.push({ idx, value: tg, bucketLabel: label, games: tg })
        }
      })
      if (hasData && rawValues.length) {
        pendingSeries.push({
          tier: 'GLOBAL',
          color: RANK_COLOR_MAP.GLOBAL ?? '#c084fc',
          rawValues,
        })
      }
    }

    if (!pendingSeries.length) return null

    const smoothedByTier = pendingSeries.map(serie => {
      const smoothValues = smoothSeries(
        serie.rawValues.map(v => v.value),
        3
      )
      if (smoothValues.length) smoothValues[0] = 0
      return { ...serie, smoothValues }
    })

    const allSmoothed = smoothedByTier.flatMap(s => s.smoothValues).filter(v => Number.isFinite(v))
    const maxVal = allSmoothed.length ? Math.max(0, ...allSmoothed) : 0
    const domainMin = 0
    const domainMax =
      mode === 'games' ? Math.max(1, maxVal * 1.08) : Math.min(100, Math.max(maxVal * 1.12, 1))
    const domainSpan = Math.max(1e-6, domainMax - domainMin)

    const series = smoothedByTier.map(serie => {
      const points: DurationSeriesPoint[] = serie.rawValues.map((v, i) => {
        const value = serie.smoothValues[i] ?? v.value
        return {
          idx: v.idx,
          x: xAt(v.idx),
          y:
            DAILY_TREND_CHART_PAD.top + (1 - (value - domainMin) / domainSpan) * DAILY_TREND_PLOT_H,
          value,
          bucketLabel: v.bucketLabel,
          games: v.games,
        }
      })
      return {
        tier: serie.tier,
        color: serie.color,
        path: buildPath(points.map(p => ({ x: p.x, y: p.y }))),
        points,
      }
    })

    const yTickCount = 5
    const yTicks: Array<{ value: number; y: number; label: string }> = []
    for (let i = 0; i < yTickCount; i++) {
      const value = domainMin + (i / (yTickCount - 1)) * domainSpan
      const y =
        DAILY_TREND_CHART_PAD.top + (1 - (value - domainMin) / domainSpan) * DAILY_TREND_PLOT_H
      yTicks.push({
        value,
        y,
        label: mode === 'games' ? `${Math.round(value)}` : `${value.toFixed(0)}%`,
      })
    }

    const tickCount = Math.min(6, Math.max(2, n))
    const step = n <= 1 ? 1 : Math.max(1, Math.floor((n - 1) / (tickCount - 1)))
    const xTicks: Array<{ index: number; x: number; label: string }> = []
    for (let i = 0; i < n; i += step) {
      const durMin = fullDurations[i]
      if (durMin === undefined) continue
      xTicks.push({ index: i, x: xAt(i), label: `${durMin}` })
    }
    const lastIdx = n - 1
    if (!xTicks.some(t => t.index === lastIdx)) {
      const durMin = fullDurations[lastIdx]
      if (durMin !== undefined) xTicks.push({ index: lastIdx, x: xAt(lastIdx), label: `${durMin}` })
    }

    const metricId: 'winrate' | 'games' = mode === 'games' ? 'games' : 'winrate'
    return {
      metricId,
      title: mode === 'games' ? options.gamesTitle.value : options.winrateTitle.value,
      series: series.filter(s => s.path.length > 0),
      xTicks,
      yTicks,
    }
  }

  const durationTrendCards = computed((): DurationTrendChartCard[] => {
    const out: DurationTrendChartCard[] = []
    const wr = buildDurationByTierChart('winrate')
    const g = buildDurationByTierChart('games')
    if (wr) out.push(wr)
    if (g) out.push(g)
    return out
  })

  const durationTooltip = ref<{
    metricId: 'winrate' | 'games'
    tier: string
    bucketLabel: string
    value: number
    games: number
    mouseX: number
    mouseY: number
  } | null>(null)

  function onDurationChartHover(
    event: MouseEvent,
    metricId: 'winrate' | 'games',
    tier: string,
    pt: DurationSeriesPoint
  ) {
    durationTooltip.value = {
      metricId,
      tier,
      bucketLabel: pt.bucketLabel,
      value: pt.value,
      games: pt.games ?? (metricId === 'games' ? Math.round(pt.value) : 0),
      mouseX: event.clientX,
      mouseY: event.clientY,
    }
  }

  return {
    DAILY_TREND_CHART_W,
    DAILY_TREND_CHART_H,
    DAILY_TREND_CHART_PAD,
    DAILY_TREND_PLOT_W,
    DAILY_TREND_PLOT_H,
    durationTrendCards,
    durationTooltip,
    isLegendTierVisible,
    toggleLegendTierVisibility,
    onDurationChartHover,
  }
}
