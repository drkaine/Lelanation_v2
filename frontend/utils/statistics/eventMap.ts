/** Carte des événements d'un champion (`GET /api/stats/champions/:id/event-map`). */

export type KillKind = 'gank' | 'roam' | 'lane' | 'jungle' | 'late'
export type WardKind = 'trinket' | 'control' | 'farsight' | 'ward'
export type CombatKind = KillKind | 'death'
export type VisionKind = WardKind | 'killed'
export type EventMapLayer = 'combat' | 'vision'
export type EventPhase = 'all' | 'early' | 'mid' | 'late'

export type EventMapApi = {
  games: number
  /** [x, y, secondes, catégorie] en coordonnées Riot. */
  kills: Array<[number, number, number, KillKind]>
  deaths: Array<[number, number, number]>
  wardsPlaced: Array<[number, number, number, WardKind]>
  wardsKilled: Array<[number, number, number, WardKind]>
}

export type EventDot = { x: number; y: number; kind: CombatKind | VisionKind }

export const COMBAT_KINDS: readonly CombatKind[] = [
  'gank',
  'roam',
  'lane',
  'jungle',
  'late',
  'death',
]
export const VISION_KINDS: readonly VisionKind[] = [
  'trinket',
  'control',
  'farsight',
  'ward',
  'killed',
]

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
  const raw: Array<[number, number, number, CombatKind | VisionKind]> =
    layer === 'combat'
      ? [
          ...data.kills,
          ...data.deaths.map(
            ([x, y, t]) => [x, y, t, 'death'] as [number, number, number, 'death']
          ),
        ]
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
