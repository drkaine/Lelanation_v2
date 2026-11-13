/** Fenêtre visible d'une carte SVG carrée 0–100 (zoom / déplacement). */
export type MapView = { x: number; y: number; w: number }

export const FULL_VIEW: MapView = { x: 0, y: 0, w: 100 }
const MIN_W = 12.5

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)
const r2 = (v: number): number => Math.round(v * 100) / 100

function fit(x: number, y: number, w: number): MapView {
  return { x: r2(clamp(x, 0, 100 - w)), y: r2(clamp(y, 0, 100 - w)), w: r2(w) }
}

/** Zoom d'un facteur `factor` (>1 = rapproche) en gardant le point (cx, cy) fixe. */
export function zoomView(view: MapView, factor: number, cx: number, cy: number): MapView {
  const w = clamp(view.w / factor, MIN_W, 100)
  const k = w / view.w
  return fit(cx - (cx - view.x) * k, cy - (cy - view.y) * k, w)
}

/** Déplacement de (dx, dy) unités carte. */
export function panView(view: MapView, dx: number, dy: number): MapView {
  return fit(view.x + dx, view.y + dy, view.w)
}

export function viewBoxAttr(view: MapView): string {
  return `${view.x} ${view.y} ${view.w} ${view.w}`
}
