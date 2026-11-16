/** Carte des événements d'un champion (`GET /api/stats/champions/:id/event-map`). */

export type KillKind = 'dive' | 'gank' | 'roam' | 'lane' | 'jungle' | 'late'
/** Contexte d'une mort : sous sa tour, jungler adverse, laner adverse hors lane, 1v1, plusieurs adversaires, autre. */
export type DeathKind = 'dive' | 'gank' | 'roam' | 'solo' | 'fight' | 'other'
export type WardKind = 'trinket' | 'control' | 'farsight' | 'ward'
export type VisionKind = WardKind | 'killed'
export type EventKind = KillKind | DeathKind | VisionKind
export type EventMapLayer = 'kills' | 'deaths' | 'vision'
export type EventPhase = 'all' | 'early' | 'mid' | 'late'

export type EventMapApi = {
  games: number
  /** [x, y, secondes, catégorie] en coordonnées Riot. */
  kills: Array<[number, number, number, KillKind]>
  deaths: Array<[number, number, number, DeathKind]>
  wardsPlaced: Array<[number, number, number, WardKind]>
  wardsKilled: Array<[number, number, number, WardKind]>
}

export type EventDot = { x: number; y: number; kind: EventKind }

export const EVENT_MAP_LAYERS: readonly EventMapLayer[] = ['kills', 'deaths', 'vision']
export const KILL_KINDS: readonly KillKind[] = ['gank', 'roam', 'dive', 'lane', 'jungle', 'late']
export const DEATH_KINDS: readonly DeathKind[] = ['dive', 'gank', 'roam', 'solo', 'fight', 'other']
export const VISION_KINDS: readonly VisionKind[] = [
  'trinket',
  'control',
  'farsight',
  'ward',
  'killed',
]

/** Catégories communes aux kills et aux morts : côté morts, clé distincte (libellé + couleur). */
const SHARED_KINDS = new Set<string>(['dive', 'gank', 'roam'])

/** Clé i18n / classe CSS d'une catégorie : `diveDeath` (sous sa tour) ≠ `dive` (sous tour adverse). */
export function eventKindKey(layer: EventMapLayer, kind: string): string {
  return layer === 'deaths' && SHARED_KINDS.has(kind) ? `${kind}Death` : kind
}

const MAP_SIZE = 15000
const EARLY_END_S = 14 * 60
const MID_END_S = 25 * 60

const round = (v: number): number => Math.round(v * 10) / 10

/** Coordonnées Riot → % SVG (viewBox 0 0 100 100, origine en haut à gauche). */
export function toMapPct(x: number, y: number): { x: number; y: number } {
  return { x: round((x / MAP_SIZE) * 100), y: round(100 - (y / MAP_SIZE) * 100) }
}

export function phaseOf(seconds: number): Exclude<EventPhase, 'all'> {
  if (seconds < EARLY_END_S) return 'early'
  if (seconds < MID_END_S) return 'mid'
  return 'late'
}

export function eventMapDots(
  data: EventMapApi | null | undefined,
  layer: EventMapLayer,
  filter: { phase: EventPhase; kinds: readonly string[] | null }
): EventDot[] {
  if (!data) return []
  const raw: Array<[number, number, number, EventKind]> =
    layer === 'kills'
      ? data.kills
      : layer === 'deaths'
        ? data.deaths
        : [
            ...data.wardsPlaced,
            ...data.wardsKilled.map(
              ([x, y, t]) => [x, y, t, 'killed'] as [number, number, number, 'killed']
            ),
          ]
  const out: EventDot[] = []
  for (const [x, y, t, kind] of raw) {
    if (filter.phase !== 'all' && phaseOf(t) !== filter.phase) continue
    if (filter.kinds && !filter.kinds.includes(kind)) continue
    out.push({ ...toMapPct(x, y), kind })
  }
  return out
}

export type EventZone = {
  /** Position moyenne des points de la zone (% carte). */
  x: number
  y: number
  count: number
  /** Catégorie la plus fréquente de la zone. */
  kind: EventKind
  /** Part des points visibles, en %. */
  pct: number
  /** Taille relative (1 = zone la plus chargée). */
  r: number
}

/** Regroupe les points en `cells`×`cells` zones ; tri croissant (les grosses zones dessinées en dernier). */
export function eventMapZones(dots: readonly EventDot[], cells: number): EventZone[] {
  if (!dots.length) return []
  const size = 100 / cells
  const acc = new Map<number, { sx: number; sy: number; n: number; kinds: Map<string, number> }>()
  for (const d of dots) {
    const cx = Math.min(cells - 1, Math.max(0, Math.floor(d.x / size)))
    const cy = Math.min(cells - 1, Math.max(0, Math.floor(d.y / size)))
    const key = cy * cells + cx
    const z = acc.get(key) ?? { sx: 0, sy: 0, n: 0, kinds: new Map() }
    z.sx += d.x
    z.sy += d.y
    z.n += 1
    z.kinds.set(d.kind, (z.kinds.get(d.kind) ?? 0) + 1)
    acc.set(key, z)
  }
  const max = Math.max(...[...acc.values()].map(z => z.n))
  return [...acc.values()]
    .map(z => ({
      x: round(z.sx / z.n),
      y: round(z.sy / z.n),
      count: z.n,
      kind: [...z.kinds.entries()].sort((a, b) => b[1] - a[1])[0]![0] as EventKind,
      pct: round((z.n / dots.length) * 100),
      r: Math.round(Math.sqrt(z.n / max) * 100) / 100,
    }))
    .sort((a, b) => a.count - b.count)
}
