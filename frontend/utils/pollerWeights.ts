/** Répartition du poller par division, en %. */
export type Weights = Record<string, number>

export function weightsTotal(weights: Weights): number {
  return Object.values(weights).reduce((a, b) => a + b, 0)
}

const floorTenth = (v: number) => Math.floor(v * 10 + 1e-9) / 10

/**
 * Fixe `tier` à `value` (borné 0-100) ; si le total dépasse 100,
 * les autres divisions sont réduites au prorata (arrondi au dixième inférieur).
 */
export function rebalanceWeights(weights: Weights, tier: string, value: number): Weights {
  const v = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
  const others = Object.entries(weights).filter(([k]) => k !== tier)
  const othersTotal = others.reduce((a, [, w]) => a + w, 0)
  const room = 100 - v
  const scale = othersTotal > room && othersTotal > 0 ? room / othersTotal : 1
  const out: Weights = {}
  for (const [k, w] of Object.entries(weights)) {
    out[k] = k === tier ? v : scale === 1 ? w : floorTenth(w * scale)
  }
  if (!(tier in out)) out[tier] = v
  return out
}
