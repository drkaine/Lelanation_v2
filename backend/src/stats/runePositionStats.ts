/** Stats primaire / secondaire par rune + fragments par keystone (à partir de rune_list "p1_p2_p3_p4_s1_s2"). */

export type RunePositionRow = { runeId: number; pos: number; games: number; wins: number }
export type RuneSideStat = { games: number; wins: number; pickrate: number; winrate: number }
export type RunePositionStat = { runeId: number; primary: RuneSideStat; secondary: RuneSideStat }
export type ShardByKeystoneRow = {
  keystoneId: number
  shardId: number
  slot: number
  games: number
  wins: number
}

const PRIMARY_SLOTS = 4
const r2 = (v: number) => Math.round(v * 100) / 100

function sideStat(games: number, wins: number, total: number): RuneSideStat {
  return {
    games,
    wins,
    pickrate: total > 0 ? r2((games / total) * 100) : 0,
    winrate: games > 0 ? r2((wins / games) * 100) : 0,
  }
}

export function foldRunePositions(rows: RunePositionRow[], totalParticipants: number): RunePositionStat[] {
  const acc = new Map<number, { pg: number; pw: number; sg: number; sw: number }>()
  for (const r of rows) {
    if (!(r.runeId > 0) || !(r.pos > 0)) continue
    let e = acc.get(r.runeId)
    if (!e) {
      e = { pg: 0, pw: 0, sg: 0, sw: 0 }
      acc.set(r.runeId, e)
    }
    if (r.pos <= PRIMARY_SLOTS) {
      e.pg += r.games
      e.pw += r.wins
    } else {
      e.sg += r.games
      e.sw += r.wins
    }
  }
  return Array.from(acc.entries()).map(([runeId, e]) => ({
    runeId,
    primary: sideStat(e.pg, e.pw, totalParticipants),
    secondary: sideStat(e.sg, e.sw, totalParticipants),
  }))
}

export function foldShardsByKeystone(rows: ShardByKeystoneRow[]): ShardByKeystoneRow[] {
  const acc = new Map<string, ShardByKeystoneRow>()
  for (const r of rows) {
    if (!(r.keystoneId > 0) || !(r.shardId > 0)) continue
    const k = `${r.keystoneId}:${r.shardId}:${r.slot}`
    const e = acc.get(k)
    if (e) {
      e.games += r.games
      e.wins += r.wins
    } else acc.set(k, { ...r })
  }
  return Array.from(acc.values())
}
