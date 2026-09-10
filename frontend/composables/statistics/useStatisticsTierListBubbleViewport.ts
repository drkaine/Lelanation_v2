import { computed, ref, watch, type Ref } from 'vue'

export type BubbleChartViewport = {
  x: number
  y: number
  w: number
  h: number
}

export function useStatisticsTierListBubbleViewport(args: {
  chartW: number
  chartH: number
  resetKey: Ref<string | number>
}) {
  const { chartW, chartH, resetKey } = args

  function fullViewport(): BubbleChartViewport {
    return { x: 0, y: 0, w: chartW, h: chartH }
  }

  const viewport = ref<BubbleChartViewport>(fullViewport())
  const isPanning = ref(false)
  const panPointerId = ref<number | null>(null)
  const panStart = ref<{ px: number; py: number; vx: number; vy: number } | null>(null)

  watch(resetKey, () => {
    viewport.value = fullViewport()
    isPanning.value = false
    panPointerId.value = null
    panStart.value = null
  })

  const viewBoxString = computed(
    () => `${viewport.value.x} ${viewport.value.y} ${viewport.value.w} ${viewport.value.h}`
  )

  const zoomPercent = computed(() => Math.round((chartW / Math.max(viewport.value.w, 1)) * 100))

  const canReset = computed(
    () =>
      viewport.value.x !== 0 ||
      viewport.value.y !== 0 ||
      Math.abs(viewport.value.w - chartW) > 0.5 ||
      Math.abs(viewport.value.h - chartH) > 0.5
  )

  function clampViewport(v: BubbleChartViewport): BubbleChartViewport {
    const minW = chartW * 0.06
    const minH = chartH * 0.06
    const w = Math.min(chartW, Math.max(minW, v.w))
    const h = Math.min(chartH, Math.max(minH, v.h))
    const x = Math.max(0, Math.min(chartW - w, v.x))
    const y = Math.max(0, Math.min(chartH - h, v.y))
    return { x, y, w, h }
  }

  function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const matrix = svg.getScreenCTM()?.inverse()
    if (!matrix) return { x: 0, y: 0 }
    const out = pt.matrixTransform(matrix)
    return { x: out.x, y: out.y }
  }

  function zoomAt(svg: SVGSVGElement, clientX: number, clientY: number, factor: number) {
    const cur = viewport.value
    const cursor = svgPoint(svg, clientX, clientY)
    const newW = cur.w * factor
    const newH = cur.h * factor
    const rx = (cursor.x - cur.x) / cur.w
    const ry = (cursor.y - cur.y) / cur.h
    viewport.value = clampViewport({
      x: cursor.x - rx * newW,
      y: cursor.y - ry * newH,
      w: newW,
      h: newH,
    })
  }

  function onWheel(event: WheelEvent, svg: SVGSVGElement) {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 1.12 : 0.88
    zoomAt(svg, event.clientX, event.clientY, factor)
  }

  function onPointerDown(event: PointerEvent, svg: SVGSVGElement) {
    if (event.button !== 0) return
    const target = event.target as Element | null
    if (target?.closest('[data-bubble-point]')) return
    isPanning.value = true
    panPointerId.value = event.pointerId
    panStart.value = {
      px: event.clientX,
      py: event.clientY,
      vx: viewport.value.x,
      vy: viewport.value.y,
    }
    svg.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent, svg: SVGSVGElement) {
    if (!isPanning.value || panPointerId.value !== event.pointerId || !panStart.value) return
    const start = panStart.value
    const rect = svg.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const dx = ((event.clientX - start.px) / rect.width) * viewport.value.w
    const dy = ((event.clientY - start.py) / rect.height) * viewport.value.h
    viewport.value = clampViewport({
      ...viewport.value,
      x: start.vx - dx,
      y: start.vy - dy,
    })
  }

  function onPointerUp(event: PointerEvent, svg: SVGSVGElement) {
    if (panPointerId.value !== event.pointerId) return
    isPanning.value = false
    panPointerId.value = null
    panStart.value = null
    try {
      svg.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  function resetViewport() {
    viewport.value = fullViewport()
  }

  function zoomIn(svg: SVGSVGElement | null) {
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    zoomAt(svg, rect.left + rect.width / 2, rect.top + rect.height / 2, 0.82)
  }

  function zoomOut(svg: SVGSVGElement | null) {
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    zoomAt(svg, rect.left + rect.width / 2, rect.top + rect.height / 2, 1.22)
  }

  return {
    viewport,
    viewBoxString,
    zoomPercent,
    canReset,
    isPanning,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    resetViewport,
    zoomIn,
    zoomOut,
  }
}
