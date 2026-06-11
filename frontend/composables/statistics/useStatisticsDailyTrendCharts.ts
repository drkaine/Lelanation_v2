import { computed, ref, type ComputedRef, type Ref } from 'vue'

export type DailyTrendSnapshotPoint = {
  dateOfGame: string
  rankTier: string
  role: string
  games: number
  wins: number
  banRatePct: number
  pickRatePct: number
}

export type DailyTrendMetricId =
  | 'games'
  | 'winrate'
  | 'pickrate'
  | 'banrate'
  | 'duration'
  | 'orderPosition'
export type DailyTrendGranularity = 'day' | 'week' | 'month' | 'patch'
export type DailyTrendDivisionPreset = 'selected' | 'average' | 'skilled' | 'elite'

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

const TREND_PRESET_TIERS: Record<Exclude<DailyTrendDivisionPreset, 'selected'>, string[]> = {
  average: ['IRON', 'BRONZE', 'SILVER', 'GOLD'],
  skilled: ['PLATINUM', 'EMERALD', 'DIAMOND'],
  elite: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
}

export const DAILY_TREND_CHART_W = 620
export const DAILY_TREND_CHART_H = 220
export const DAILY_TREND_CHART_PAD = { left: 40, right: 16, top: 12, bottom: 30 }
export const DAILY_TREND_PLOT_W =
  DAILY_TREND_CHART_W - DAILY_TREND_CHART_PAD.left - DAILY_TREND_CHART_PAD.right
export const DAILY_TREND_PLOT_H =
  DAILY_TREND_CHART_H - DAILY_TREND_CHART_PAD.top - DAILY_TREND_CHART_PAD.bottom

function normalizeRankTier(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .split('_')[0]!
  if (!normalized || normalized === 'UNRANKED') return ''
  return normalized
}

function isoWeekBucket(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return dateIso
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() - day + 1)
  return d.toISOString().slice(0, 10)
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

function metricValue(
  metric: DailyTrendMetricId,
  raw: { games: number; wins: number; pickNum: number; banNum: number; weight: number }
): number {
  if (metric === 'games') return raw.games
  if (metric === 'winrate') return raw.games > 0 ? (100 * raw.wins) / raw.games : 0
  if (metric === 'pickrate') return raw.weight > 0 ? raw.pickNum / raw.weight : 0
  if (metric === 'duration' || metric === 'orderPosition') {
    return raw.weight > 0 ? raw.pickNum / raw.weight : 0
  }
  return raw.weight > 0 ? raw.banNum / raw.weight : 0
}

export function useStatisticsDailyTrendCharts(options: {
  points: Ref<DailyTrendSnapshotPoint[]>
  filterRank: Ref<string[]>
  showBanrate: Ref<boolean> | ComputedRef<boolean>
  versionsCatalog: Ref<Array<{ patchLabel: string; releaseDate: string }>>
  metricTitles: ComputedRef<Partial<Record<DailyTrendMetricId, string>>>
  enabledMetrics?: Ref<DailyTrendMetricId[]> | ComputedRef<DailyTrendMetricId[]>
  seriesLabel?: (tier: string) => string
  tierColor?: (tier: string) => string
  formatMetricValue?: (metric: DailyTrendMetricId, value: number) => string
  tierSortOrder?: (a: string, b: string) => number
}) {
  const trendGranularity = ref<DailyTrendGranularity>('day')
  const trendRangeMode = ref<'7d' | '14d' | 'months'>('7d')
  const trendMonthsWindow = ref(1)
  const trendDivisionPreset = ref<DailyTrendDivisionPreset>('selected')
  const trendShowGlobalLine = ref(true)
  const hiddenLegendTiers = ref<string[]>([])
  const trendTooltip = ref<{
    metricId: DailyTrendMetricId
    tier: string
    label: string
    bucketLabel: string
    value: number
    winrate: number | null
    games: number
    mouseX: number
    mouseY: number
  } | null>(null)

  function setTrendDivisionPreset(preset: DailyTrendDivisionPreset): void {
    trendDivisionPreset.value = preset
    if (preset === 'selected') return
    options.filterRank.value = [...TREND_PRESET_TIERS[preset]]
  }

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

  function resolvePatchLabelForDate(dateIso: string): string {
    const catalog = options.versionsCatalog.value
    if (!catalog.length) return dateIso.slice(0, 7)
    const ts = new Date(`${dateIso}T00:00:00.000Z`).getTime()
    if (!Number.isFinite(ts)) return dateIso.slice(0, 7)
    let match: string | null = null
    for (const entry of catalog) {
      const ets = new Date(`${entry.releaseDate}T00:00:00.000Z`).getTime()
      if (!Number.isFinite(ets)) continue
      if (ets <= ts) match = entry.patchLabel
      else break
    }
    return match ?? catalog[0]?.patchLabel ?? dateIso.slice(0, 7)
  }

  const trendSelectedTiers = computed(() => {
    const selected = Array.from(new Set(options.filterRank.value.map(normalizeRankTier))).filter(
      Boolean
    )
    if (selected.length) return selected
    const fromData = Array.from(
      new Set(options.points.value.map(p => normalizeRankTier(p.rankTier)))
    ).filter(Boolean)
    const defaultSort = (a: string, b: string) =>
      (!RANK_TIERS.includes(a as (typeof RANK_TIERS)[number])
        ? 999
        : RANK_TIERS.indexOf(a as (typeof RANK_TIERS)[number])) -
      (!RANK_TIERS.includes(b as (typeof RANK_TIERS)[number])
        ? 999
        : RANK_TIERS.indexOf(b as (typeof RANK_TIERS)[number]))
    return fromData.sort(options.tierSortOrder ?? defaultSort)
  })

  const trendMetricDefs = computed(() => {
    const titles = options.metricTitles.value
    const coreDefs: Array<{ id: DailyTrendMetricId; title: string }> = [
      { id: 'games', title: titles.games ?? '' },
      { id: 'winrate', title: titles.winrate ?? '' },
      { id: 'pickrate', title: titles.pickrate ?? '' },
    ]
    if (options.showBanrate.value) {
      coreDefs.push({ id: 'banrate', title: titles.banrate ?? '' })
    }
    const optionalDefs: Array<{ id: DailyTrendMetricId; title: string }> = [
      { id: 'duration', title: titles.duration ?? '' },
      { id: 'orderPosition', title: titles.orderPosition ?? '' },
    ]
    const enabled = options.enabledMetrics?.value
    if (!enabled?.length) return coreDefs
    const enabledSet = new Set(enabled)
    return [...coreDefs, ...optionalDefs].filter(
      def => enabledSet.has(def.id) && Boolean(def.title)
    )
  })

  const trendBuckets = computed(() => {
    const map = new Map<
      string,
      {
        key: string
        label: string
        ts: number
        byTier: Map<
          string,
          { games: number; wins: number; pickNum: number; banNum: number; weight: number }
        >
      }
    >()
    for (const p of options.points.value) {
      const tier = normalizeRankTier(p.rankTier)
      if (!tier) continue
      const dateIso = p.dateOfGame
      let key = dateIso
      let label = dateIso.slice(5)
      if (trendGranularity.value === 'week') {
        key = isoWeekBucket(dateIso)
        label = key
      } else if (trendGranularity.value === 'month') {
        key = `${dateIso.slice(0, 7)}-01`
        label = dateIso.slice(0, 7)
      } else if (trendGranularity.value === 'patch') {
        key = resolvePatchLabelForDate(dateIso)
        label = key
      }
      const ts =
        trendGranularity.value === 'patch'
          ? new Date(`${dateIso}T00:00:00.000Z`).getTime()
          : new Date(`${key}T00:00:00.000Z`).getTime()
      if (!map.has(key)) map.set(key, { key, label, ts, byTier: new Map() })
      const bucket = map.get(key)
      if (!bucket) continue
      bucket.ts = Number.isFinite(bucket.ts) ? Math.min(bucket.ts, ts) : ts
      const prev = bucket.byTier.get(tier) ?? {
        games: 0,
        wins: 0,
        pickNum: 0,
        banNum: 0,
        weight: 0,
      }
      const games = Number(p.games) || 0
      prev.games += games
      prev.wins += Number(p.wins) || 0
      prev.pickNum += (Number(p.pickRatePct) || 0) * games
      prev.banNum += (Number(p.banRatePct) || 0) * games
      prev.weight += games
      bucket.byTier.set(tier, prev)
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.ts - b.ts)
    if (!sorted.length) return sorted
    const latestTs = sorted[sorted.length - 1]?.ts ?? 0
    if (!Number.isFinite(latestTs) || latestTs <= 0) return sorted
    const daysBack =
      trendRangeMode.value === '7d'
        ? 7
        : trendRangeMode.value === '14d'
          ? 14
          : Math.max(1, Math.min(24, Number(trendMonthsWindow.value) || 1)) * 30
    const minTs = latestTs - (daysBack - 1) * 24 * 60 * 60 * 1000
    return sorted.filter(b => b.ts >= minTs)
  })

  const trendChartCards = computed(() => {
    const buckets = trendBuckets.value
    const tiers = trendSelectedTiers.value
    if (!buckets.length || !tiers.length) return []
    const n = buckets.length
    const xAt = (index: number) =>
      DAILY_TREND_CHART_PAD.left + (n <= 1 ? 0 : index / (n - 1)) * DAILY_TREND_PLOT_W

    return trendMetricDefs.value.map(metric => {
      const globalRawByIndex = buckets.map(() => ({
        games: 0,
        wins: 0,
        pickNum: 0,
        banNum: 0,
        weight: 0,
      }))
      buckets.forEach((bucket, index) => {
        const global = globalRawByIndex[index]
        if (!global) return
        for (const [, raw] of bucket.byTier) {
          global.games += raw.games
          global.wins += raw.wins
          global.pickNum += raw.pickNum
          global.banNum += raw.banNum
          global.weight += raw.weight
        }
      })

      const pendingSeries = tiers.map(tier => {
        const rawValues: Array<{
          idx: number
          value: number
          bucketLabel: string
          games: number
          wins: number
          winrate: number | null
        }> = []
        buckets.forEach((bucket, index) => {
          const raw = bucket.byTier.get(tier)
          if (!raw) return
          const games = Number(raw.games) || 0
          const wins = Number(raw.wins) || 0
          rawValues.push({
            idx: index,
            value: metricValue(metric.id, raw),
            bucketLabel: bucket.label,
            games,
            wins,
            winrate: games > 0 ? (100 * wins) / games : null,
          })
        })
        return {
          tier,
          label: options.seriesLabel?.(tier) ?? tier,
          color: options.tierColor?.(tier) ?? RANK_COLOR_MAP[tier] ?? '#64748b',
          rawValues,
        }
      })

      if (trendShowGlobalLine.value) {
        const rawValues: Array<{
          idx: number
          value: number
          bucketLabel: string
          games: number
          wins: number
          winrate: number | null
        }> = []
        globalRawByIndex.forEach((raw, idx) => {
          if (raw.weight <= 0 && raw.games <= 0) return
          const games = Number(raw.games) || 0
          const wins = Number(raw.wins) || 0
          rawValues.push({
            idx,
            value: metricValue(metric.id, raw),
            bucketLabel: buckets[idx]?.label ?? '',
            games,
            wins,
            winrate: games > 0 ? (100 * wins) / games : null,
          })
        })
        if (rawValues.length) {
          pendingSeries.push({
            tier: 'GLOBAL',
            label: options.seriesLabel?.('GLOBAL') ?? 'GLOBAL',
            color: options.tierColor?.('GLOBAL') ?? RANK_COLOR_MAP.GLOBAL ?? '#c084fc',
            rawValues,
          })
        }
      }

      const smoothedByTier = pendingSeries.map(serie => ({
        ...serie,
        smoothValues: smoothSeries(
          serie.rawValues.map(v => v.value),
          3
        ),
      }))

      const allValues = smoothedByTier.flatMap(s => s.smoothValues).filter(v => Number.isFinite(v))
      let minVal = allValues.length ? Math.min(...allValues) : 0
      let maxVal = allValues.length ? Math.max(...allValues) : 1
      if (!Number.isFinite(minVal)) minVal = 0
      if (!Number.isFinite(maxVal)) maxVal = 1
      if (metric.id === 'games') {
        minVal = 0
        if (maxVal <= 0) maxVal = 1
      } else if (metric.id === 'orderPosition') {
        minVal = Math.max(1, minVal)
        if (maxVal <= minVal) maxVal = minVal + 1
      } else if (maxVal <= minVal) {
        maxVal =
          minVal +
          (metric.id === 'pickrate' || metric.id === 'banrate'
            ? 0.5
            : metric.id === 'duration'
              ? 60_000
              : 1)
      }
      const spread = Math.max(1e-6, maxVal - minVal)
      const domainMin =
        metric.id === 'games'
          ? 0
          : metric.id === 'orderPosition'
            ? Math.max(1, minVal - spread * 0.15)
            : Math.max(0, minVal - spread * 0.12)
      const domainMax = maxVal + spread * 0.08
      const domainSpan = Math.max(1e-6, domainMax - domainMin)

      const series = smoothedByTier.map(serie => {
        const points = serie.rawValues.map((v, i) => {
          const value = serie.smoothValues[i] ?? v.value
          return {
            idx: v.idx,
            x: xAt(v.idx),
            y:
              DAILY_TREND_CHART_PAD.top +
              (1 - (value - domainMin) / domainSpan) * DAILY_TREND_PLOT_H,
            value,
            bucketLabel: v.bucketLabel,
            games: v.games,
            wins: v.wins,
            winrate: v.winrate,
          }
        })
        return {
          tier: serie.tier,
          label: serie.label ?? serie.tier,
          color: serie.color,
          path: buildPath(points.map(p => ({ x: p.x, y: p.y }))),
          points,
        }
      })

      const yTicks: Array<{ value: number; y: number; label: string }> = []
      for (let i = 0; i <= 4; i += 1) {
        const value = domainMin + (domainSpan * i) / 4
        yTicks.push({
          value,
          y: DAILY_TREND_CHART_PAD.top + (1 - i / 4) * DAILY_TREND_PLOT_H,
          label: options.formatMetricValue
            ? options.formatMetricValue(metric.id, value)
            : metric.id === 'games'
              ? `${Math.round(value)}`
              : `${value.toFixed(1)}%`,
        })
      }
      const tickCount = Math.min(6, Math.max(2, buckets.length))
      const step =
        buckets.length <= 1 ? 1 : Math.max(1, Math.floor((buckets.length - 1) / (tickCount - 1)))
      const xTicks: Array<{ index: number; x: number; label: string }> = []
      for (let i = 0; i < buckets.length; i += step) {
        const b = buckets[i]
        if (!b) continue
        xTicks.push({ index: i, x: xAt(i), label: b.label })
      }
      const lastIdx = buckets.length - 1
      if (!xTicks.some(t => t.index === lastIdx)) {
        const b = buckets[lastIdx]
        if (b) xTicks.push({ index: lastIdx, x: xAt(lastIdx), label: b.label })
      }
      return {
        metricId: metric.id,
        title: metric.title,
        series: series.filter(s => s.path.length > 0),
        xTicks,
        yTicks,
      }
    })
  })

  function formatTrendValue(metric: DailyTrendMetricId, value: number): string {
    if (options.formatMetricValue) return options.formatMetricValue(metric, value)
    if (metric === 'games') return `${Math.round(value)}`
    return `${Number(value).toFixed(2)}%`
  }

  function onTrendPointHover(
    event: MouseEvent,
    metricId: DailyTrendMetricId,
    tier: string,
    pt: {
      bucketLabel: string
      value: number
      winrate?: number | null
      games?: number
    },
    label?: string
  ): void {
    trendTooltip.value = {
      metricId,
      tier,
      label: label ?? options.seriesLabel?.(tier) ?? tier,
      bucketLabel: pt.bucketLabel,
      value: pt.value,
      winrate: pt.winrate ?? null,
      games: Number(pt.games) || 0,
      mouseX: event.clientX,
      mouseY: event.clientY,
    }
  }

  return {
    trendGranularity,
    trendRangeMode,
    trendMonthsWindow,
    trendDivisionPreset,
    trendShowGlobalLine,
    hiddenLegendTiers,
    trendTooltip,
    trendChartCards,
    trendSelectedTiers,
    setTrendDivisionPreset,
    isLegendTierVisible,
    toggleLegendTierVisibility,
    formatTrendValue,
    onTrendPointHover,
  }
}
