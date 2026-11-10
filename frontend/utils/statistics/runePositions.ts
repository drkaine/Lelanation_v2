import type { RunesDetailPayload, RuneSideStat } from '~/types/statisticsIndexPage'

type Positions = RunesDetailPayload['runePositions']
type KsRows = RunesDetailPayload['shardsByKeystone']
type ShardRow = NonNullable<RunesDetailPayload['shards']>[number]

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0)

/** runeId → stats quand la rune est prise en arbre primaire / secondaire. */
export function runeSideMap(
  positions: Positions
): Record<number, { primary: RuneSideStat; secondary: RuneSideStat }> {
  const m: Record<number, { primary: RuneSideStat; secondary: RuneSideStat }> = {}
  for (const p of positions ?? []) m[p.runeId] = { primary: p.primary, secondary: p.secondary }
  return m
}

/**
 * Fragments joués avec un keystone de l'arbre (= arbre primaire).
 * `totalParticipants` = parties de l'arbre (somme du slot 0), base du pickrate.
 */
export function shardsForTree(
  rows: KsRows,
  keystoneIds: number[]
): { totalParticipants: number; shards: ShardRow[] } {
  const ks = new Set(keystoneIds)
  const acc = new Map<string, { shardId: number; slot: number; games: number; wins: number }>()
  for (const r of rows ?? []) {
    if (!ks.has(r.keystoneId)) continue
    const k = `${r.shardId}:${r.slot}`
    const cur = acc.get(k) ?? { shardId: r.shardId, slot: r.slot, games: 0, wins: 0 }
    cur.games += r.games
    cur.wins += r.wins
    acc.set(k, cur)
  }
  const list = [...acc.values()]
  const totalParticipants = list.filter(s => s.slot === 0).reduce((a, s) => a + s.games, 0)
  return {
    totalParticipants,
    shards: list.map(s => ({
      ...s,
      pickrate: pct(s.games, totalParticipants),
      winrate: pct(s.wins, s.games),
    })),
  }
}

export type RuneSide = 'primary' | 'secondary'

/**
 * Cellules d'un arbre pour un côté : primaire = arbre entier, secondaire = sans keystones (row 0).
 * Stats remplacées par celles du côté ; null si aucune partie.
 */
export function sideTreeCells<C extends { row: number; rune: { id: number } }>(
  cells: C[],
  map: Record<number, { primary: RuneSideStat; secondary: RuneSideStat }>,
  side: RuneSide
): Array<
  Omit<C, 'stats'> & { stats: { games: number; pickrate: number; winrate: number } | null }
> {
  return cells
    .filter(c => side === 'primary' || c.row > 0)
    .map(c => {
      const st = map[c.rune.id]?.[side]
      return {
        ...c,
        stats:
          st && st.games > 0
            ? { games: st.games, pickrate: st.pickrate, winrate: st.winrate }
            : null,
      }
    })
}
