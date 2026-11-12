/** Chemins de jungle (`GET /api/stats/champions/:id/jungle-paths`). */

export type JunglePathApiRow = {
  teamId: number
  pathSequence: string[]
  pathHash: string
  games: number
  wins: number
  /** 0–1 */
  winrate: number
  avgClearTimeMs: number | null
}

export type CampType =
  | 'blue_buff'
  | 'red_buff'
  | 'gromp'
  | 'wolves'
  | 'raptors'
  | 'krugs'
  | 'scuttler'
  | 'dragon'
  | 'baron'
  | 'unknown'

export type JungleStep = {
  key: string
  type: CampType
  /** Côté du camp sur la carte. */
  side: 'blue' | 'red' | null
  /** Position en % (0–100), origine en haut à gauche (SVG). */
  x: number
  y: number
}

export type JunglePathView = {
  hash: string
  side: 'blue' | 'red'
  steps: JungleStep[]
  games: number
  /** 0–100 */
  winrate: number
  clearTime: string | null
  /** Points `x,y` pour un `<polyline>` en viewBox 0 0 100 100. */
  polyline: string
}

const MAP_SIZE = 15000

/** Miroir front de `CAMP_POSITIONS` (backend/src/constants/mapSpatial.ts). */
const CAMP_POSITIONS: Record<string, { x: number; y: number }> = {
  blue_buff_blue: { x: 3800, y: 7800 },
  red_buff_blue: { x: 7800, y: 3900 },
  gromp_blue: { x: 2800, y: 8600 },
  wolves_blue: { x: 3300, y: 6300 },
  raptors_blue: { x: 6700, y: 2900 },
  krugs_blue: { x: 8200, y: 2300 },
  blue_buff_red: { x: 11200, y: 7200 },
  red_buff_red: { x: 7200, y: 11100 },
  gromp_red: { x: 12200, y: 6400 },
  wolves_red: { x: 11700, y: 8700 },
  raptors_red: { x: 8300, y: 12100 },
  krugs_red: { x: 6800, y: 12700 },
  scuttler_blue: { x: 4100, y: 4100 },
  scuttler_red: { x: 11900, y: 4100 },
  dragon: { x: 9900, y: 4600 },
  baron: { x: 4900, y: 10400 },
}

const TYPES: CampType[] = [
  'blue_buff',
  'red_buff',
  'gromp',
  'wolves',
  'raptors',
  'krugs',
  'scuttler',
  'dragon',
  'baron',
]

export function jungleStep(key: string): JungleStep {
  const k = String(key ?? '')
    .trim()
    .toLowerCase()
  const side = k.endsWith('_blue') ? 'blue' : k.endsWith('_red') ? 'red' : null
  const base = side ? k.slice(0, -(side.length + 1)) : k
  const type = (TYPES as string[]).includes(base) ? (base as CampType) : 'unknown'
  const pos = CAMP_POSITIONS[k]
  const round = (v: number) => Math.round(v * 10) / 10
  return {
    key: k,
    type,
    side,
    x: pos ? round((pos.x / MAP_SIZE) * 100) : 50,
    y: pos ? round(100 - (pos.y / MAP_SIZE) * 100) : 50,
  }
}

export function formatClearTime(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** `16.22.1` → `16.22` (l'API stocke le patch en major.minor). */
export function jungleApiPatch(version: string | null | undefined): string | null {
  const m = String(version ?? '').match(/^(\d+)\.(\d+)/)
  return m ? `${m[1]}.${m[2]}` : null
}

export function junglePathViews(
  rows: JunglePathApiRow[],
  opts: { limit: number; side?: 'blue' | 'red' | null }
): JunglePathView[] {
  return rows
    .filter(r => r.pathSequence?.length && r.games > 0)
    .map(r => {
      const steps = r.pathSequence.map(jungleStep)
      return {
        hash: r.pathHash,
        side: r.teamId === 200 ? ('red' as const) : ('blue' as const),
        steps,
        games: r.games,
        winrate: Math.round(r.winrate * 1000) / 10,
        clearTime: formatClearTime(r.avgClearTimeMs),
        polyline: steps.map(s => `${s.x},${s.y}`).join(' '),
      }
    })
    .filter(p => !opts.side || p.side === opts.side)
    .sort((a, b) => b.games - a.games || b.winrate - a.winrate)
    .slice(0, opts.limit)
}
