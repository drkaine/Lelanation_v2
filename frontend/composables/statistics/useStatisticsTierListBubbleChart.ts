import { computed, ref, watch, type ComputedRef } from 'vue'

export type TierListBubbleRow = {
  championId: number
  winrate: number
  pickrate: number
  banrate: number
  games: number
  tier: string
}

export type TierListBubblePoint = {
  championId: number
  pickPct: number
  winPct: number
  banPct: number
  tier: string
  cx: number
  cy: number
  r: number
  labelX: number
  labelY: number
  color: string
}

export const BUBBLE_CHART_W = 1280
export const BUBBLE_CHART_H = 760
export const BUBBLE_CHART_PAD = { left: 64, right: 36, top: 56, bottom: 56 }

const BUBBLE_MIN_R = 10
const BUBBLE_MAX_R = 52
const BAN_SPREAD_EPS = 0.001

function toPctFraction(value: number): number {
  if (!Number.isFinite(value)) return 0
  // API returns 0–1 fractions; tolerate already-percent values.
  return value > 1 ? value : value * 100
}

function bubbleRadiusFromMetrics(
  banPct: number,
  games: number,
  minBan: number,
  maxBan: number,
  minGames: number,
  maxGames: number
): number {
  const banSpread = maxBan - minBan
  if (banSpread > BAN_SPREAD_EPS) {
    const t = (banPct - minBan) / banSpread
    return BUBBLE_MIN_R + Math.sqrt(Math.max(0, Math.min(1, t))) * (BUBBLE_MAX_R - BUBBLE_MIN_R)
  }
  const gamesSpread = maxGames - minGames
  if (gamesSpread > 0) {
    const t = (games - minGames) / gamesSpread
    return BUBBLE_MIN_R + Math.sqrt(Math.max(0, Math.min(1, t))) * (BUBBLE_MAX_R - BUBBLE_MIN_R)
  }
  return (BUBBLE_MIN_R + BUBBLE_MAX_R) / 2
}

export type TierListBubbleLabel = {
  championId: number
  x: number
  y: number
  anchor: 'middle' | 'start' | 'end'
  fontSize: number
  hidden: boolean
}

type LabelBox = { x1: number; y1: number; x2: number; y2: number }

function labelBox(
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: 'middle' | 'start' | 'end'
): LabelBox {
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
  return { x1: left - 2, y1: y - height, x2: left + width + 2, y2: y + 2 }
}

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2)
}

function bubbleBox(point: TierListBubblePoint): LabelBox {
  return {
    x1: point.cx - point.r - 2,
    y1: point.cy - point.r - 2,
    x2: point.cx + point.r + 2,
    y2: point.cy + point.r + 2,
  }
}

export function computeBubbleLabelPlacements(
  points: TierListBubblePoint[],
  labelFor: (championId: number) => string
): TierListBubbleLabel[] {
  const occupied: LabelBox[] = []
  const sorted = [...points].sort((a, b) => b.r - a.r || b.banPct - a.banPct)

  return sorted.map(point => {
    const text = labelFor(point.championId)
    const width = Math.min(120, Math.max(34, text.length * 5.4))
    const height = 11
    const fontSize = text.length > 12 ? 8.5 : text.length > 9 ? 9.5 : 10.5
    const candidates: Array<{ x: number; y: number; anchor: 'middle' | 'start' | 'end' }> = [
      { x: point.cx, y: point.cy - point.r - 5, anchor: 'middle' },
      { x: point.cx, y: point.cy + point.r + 11, anchor: 'middle' },
      { x: point.cx - point.r - 5, y: point.cy + 3, anchor: 'end' },
      { x: point.cx + point.r + 5, y: point.cy + 3, anchor: 'start' },
    ]

    const bubble = bubbleBox(point)
    let chosen = candidates[0]!
    let crowded = true

    for (const candidate of candidates) {
      const box = labelBox(candidate.x, candidate.y, width, height, candidate.anchor)
      const hitsBubble = boxesOverlap(box, bubble)
      const hitsLabel = occupied.some(o => boxesOverlap(box, o))
      if (!hitsBubble && !hitsLabel) {
        chosen = candidate
        occupied.push(box)
        crowded = false
        break
      }
    }

    return {
      championId: point.championId,
      x: chosen.x,
      y: chosen.y,
      anchor: chosen.anchor,
      fontSize,
      hidden: crowded,
    }
  })
}

function snapDown(value: number, step: number): number {
  return Math.floor(value / step) * step
}

function snapUp(value: number, step: number): number {
  return Math.ceil(value / step) * step
}

function pickStep(range: number): number {
  if (range <= 2) return 0.5
  if (range <= 5) return 1
  if (range <= 12) return 2
  if (range <= 24) return 4
  return 5
}

function winStep(range: number): number {
  if (range <= 3) return 0.5
  if (range <= 8) return 1
  return 2
}

function buildTicks(min: number, max: number, step: number): number[] {
  const lo = snapDown(min, step)
  const hi = snapUp(max, step)
  const out: number[] = []
  for (let v = lo; v <= hi + 1e-6; v += step) {
    out.push(Math.round(v * 1000) / 1000)
  }
  return out
}

export function useStatisticsTierListBubbleChart(args: {
  rows: ComputedRef<TierListBubbleRow[]>
  referenceRows?: ComputedRef<TierListBubbleRow[]>
  tierColor: (tier: string) => string
}) {
  const { rows, referenceRows, tierColor } = args

  const tooltip = ref<{ championId: number; x: number; y: number } | null>(null)

  watch(rows, () => {
    tooltip.value = null
  })

  const layout = computed(() => {
    const list = rows.value
    const scopeList =
      referenceRows?.value && referenceRows.value.length > 0 ? referenceRows.value : list
    const plotW = BUBBLE_CHART_W - BUBBLE_CHART_PAD.left - BUBBLE_CHART_PAD.right
    const plotH = BUBBLE_CHART_H - BUBBLE_CHART_PAD.top - BUBBLE_CHART_PAD.bottom

    if (scopeList.length === 0) {
      const plotW = BUBBLE_CHART_W - BUBBLE_CHART_PAD.left - BUBBLE_CHART_PAD.right
      const plotH = BUBBLE_CHART_H - BUBBLE_CHART_PAD.top - BUBBLE_CHART_PAD.bottom
      const xMin = 0
      const xMax = 12
      const yMin = 46
      const yMax = 54
      const refPickPct = 3
      const refWinPct = 50
      const toX = (pickPct: number) =>
        BUBBLE_CHART_PAD.left + ((pickPct - xMin) / (xMax - xMin)) * plotW
      const toY = (winPct: number) =>
        BUBBLE_CHART_PAD.top + plotH - ((winPct - yMin) / (yMax - yMin)) * plotH
      return {
        plotW,
        plotH,
        xMin,
        xMax,
        yMin,
        yMax,
        refPickPct,
        refWinPct,
        refX: toX(refPickPct),
        refY: toY(refWinPct),
        xTicks: [0, 2, 4, 6, 8, 10, 12],
        yTicks: [46, 48, 50, 52, 54],
        minBanPct: 0,
        maxBanPct: 1,
        sizeUsesBanRate: true,
        points: [] as TierListBubblePoint[],
      }
    }

    const pickPcts = scopeList.map(r => toPctFraction(r.pickrate))
    const winPcts = scopeList.map(r => toPctFraction(r.winrate))
    const banPcts = scopeList.map(r => toPctFraction(r.banrate ?? 0))
    const gamesList = scopeList.map(r => r.games ?? 0)
    const minBanPct = Math.min(...banPcts)
    const maxBanPct = Math.max(...banPcts)
    const minGames = Math.min(...gamesList)
    const maxGames = Math.max(...gamesList)

    const refPickPct = pickPcts.reduce((a, b) => a + b, 0) / pickPcts.length
    const refWinPct = winPcts.reduce((a, b) => a + b, 0) / winPcts.length

    const rawPickMin = Math.min(...pickPcts, refPickPct)
    const rawPickMax = Math.max(...pickPcts, refPickPct)
    const rawWinMin = Math.min(...winPcts, refWinPct)
    const rawWinMax = Math.max(...winPcts, refWinPct)

    const pickPad = Math.max(0.4, (rawPickMax - rawPickMin) * 0.12)
    const winPad = Math.max(0.4, (rawWinMax - rawWinMin) * 0.12)

    const xStep = pickStep(rawPickMax - rawPickMin + pickPad * 2)
    const yStep = winStep(rawWinMax - rawWinMin + winPad * 2)

    const xMin = Math.max(0, snapDown(rawPickMin - pickPad, xStep))
    let xMax = Math.max(xMin + xStep, snapUp(rawPickMax + pickPad, xStep))
    const yMin = snapDown(rawWinMin - winPad, yStep)
    let yMax = snapUp(rawWinMax + winPad, yStep)
    if (xMax <= xMin) xMax = xMin + xStep
    if (yMax <= yMin) yMax = yMin + yStep

    const xTicks = buildTicks(xMin, xMax, xStep)
    const yTicks = buildTicks(yMin, yMax, yStep)

    const toX = (pickPct: number) =>
      BUBBLE_CHART_PAD.left + ((pickPct - xMin) / (xMax - xMin)) * plotW
    const toY = (winPct: number) =>
      BUBBLE_CHART_PAD.top + plotH - ((winPct - yMin) / (yMax - yMin)) * plotH

    const refX = toX(refPickPct)
    const refY = toY(refWinPct)

    const points: TierListBubblePoint[] = list.map(row => {
      const pickPct = toPctFraction(row.pickrate)
      const winPct = toPctFraction(row.winrate)
      const banPct = toPctFraction(row.banrate ?? 0)
      const r = bubbleRadiusFromMetrics(
        banPct,
        row.games ?? 0,
        minBanPct,
        maxBanPct,
        minGames,
        maxGames
      )
      const cx = toX(pickPct)
      const cy = toY(winPct)
      return {
        championId: row.championId,
        pickPct,
        winPct,
        banPct,
        tier: row.tier,
        cx,
        cy,
        r,
        labelX: cx,
        labelY: cy - r - 8,
        color: tierColor(row.tier),
      }
    })

    return {
      plotW,
      plotH,
      xMin,
      xMax,
      yMin,
      yMax,
      refPickPct,
      refWinPct,
      refX,
      refY,
      xTicks,
      yTicks,
      minBanPct,
      maxBanPct,
      sizeUsesBanRate: maxBanPct - minBanPct > BAN_SPREAD_EPS,
      points,
    }
  })

  const tooltipPoint = computed(() => {
    const tip = tooltip.value
    if (!tip) return null
    return layout.value.points.find(p => p.championId === tip.championId) ?? null
  })

  function onBubbleEnter(championId: number, event: MouseEvent) {
    tooltip.value = { championId, x: event.clientX, y: event.clientY }
  }

  function onBubbleMove(event: MouseEvent) {
    const tip = tooltip.value
    if (!tip) return
    tooltip.value = { ...tip, x: event.clientX, y: event.clientY }
  }

  function onBubbleLeave() {
    tooltip.value = null
  }

  function formatPct(value: number, decimals = 2): string {
    return `${value.toFixed(decimals)}%`
  }

  return {
    layout,
    tooltip,
    tooltipPoint,
    onBubbleEnter,
    onBubbleMove,
    onBubbleLeave,
    formatPct,
  }
}
