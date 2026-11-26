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

/** « Toutes les régions » : mêmes poids partout ; « par région » : poids propres à chaque plateforme. */
export type WeightsMode = 'all' | 'byRegion'

/** Poids de chaque plateforme : ceux enregistrés, sinon copie des poids toutes régions. */
/** Poids par région de limite (europe, americas, asia, sea) : enregistrés, sinon copie des poids globaux. */
export function initRegionWeights(
  clusters: readonly string[],
  global: Weights,
  saved: Record<string, Weights>
): Record<string, Weights> {
  return Object.fromEntries(clusters.map(c => [c, { ...(saved[c] ?? global) }]))
}

/** Régions de limite des plateformes cochées, sans doublon, dans l'ordre des choix. */
export function selectedClusters(
  choices: readonly { platform: string; cluster: string }[],
  platforms: readonly string[]
): string[] {
  return [...new Set(choices.filter(c => platforms.includes(c.platform)).map(c => c.cluster))]
}

export function settingsBody(
  platforms: readonly string[],
  clusters: readonly string[],
  tierWeights: Weights,
  mode: WeightsMode,
  byRegion: Record<string, Weights>
) {
  const body = { platforms: [...platforms], tierWeights }
  if (mode === 'all') return body
  return { ...body, tierWeightsByRegion: initRegionWeights(clusters, tierWeights, byRegion) }
}
