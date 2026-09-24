/**
 * Logique pure du dashboard champion : géométrie du radar et formats d'affichage.
 * Séparée du composant pour être testable sans monter Vue.
 */

export const DASHBOARD_RADAR_AXES = [
  'damage',
  'tank',
  'sustain',
  'aggro',
  'team',
  'economy',
  'vision',
  'objects',
] as const

export type DashboardRadarAxis = (typeof DASHBOARD_RADAR_AXES)[number]

export type RadarPoint = { x: number; y: number }

/**
 * Point du radar pour l'axe `index` sur `count`, valeur 0–100.
 * Le premier axe part vers la droite et le sens est anti-horaire (comme le dashboard de référence : Damage à droite, Sustain en haut).
 */
export function radarPoint(
  index: number,
  count: number,
  value: number,
  radius: number,
  cx: number,
  cy: number
): RadarPoint {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const angle = (2 * Math.PI * index) / count
  const r = (clamped / 100) * radius
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) }
}

export function radarPolygonPoints(
  values: readonly number[],
  radius: number,
  cx: number,
  cy: number
): string {
  return values
    .map((v, i) => radarPoint(i, values.length, v, radius, cx, cy))
    .map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')
}

/** Largeur de barre en % : borne 0–100, NaN → 0. */
export function barWidthPct(percentile: number): number {
  if (!Number.isFinite(percentile)) return 0
  return Math.max(0, Math.min(100, percentile))
}

/** Largeur de barre d'une sous-ligne de dropdown : sa part (%) dans la valeur parente. */
export function breakdownSharePct(value: number, parent: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(parent) || parent <= 0) return 0
  return barWidthPct((value / parent) * 100)
}

export function formatDashboardValue(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Objets les plus joués : somme des parties de chaque build où l'objet apparaît
 * (une seule fois par build), triés par parties décroissantes.
 */
export function topItemsFromBuilds(
  builds: ReadonlyArray<{ items: number[]; games: number }>,
  limit: number
): Array<{ itemId: number; games: number }> {
  const totals = new Map<number, number>()
  for (const build of builds) {
    for (const id of new Set(build.items)) {
      if (!id) continue
      totals.set(id, (totals.get(id) ?? 0) + build.games)
    }
  }
  return [...totals.entries()]
    .map(([itemId, games]) => ({ itemId, games }))
    .sort((a, b) => b.games - a.games || a.itemId - b.itemId)
    .slice(0, limit)
}
