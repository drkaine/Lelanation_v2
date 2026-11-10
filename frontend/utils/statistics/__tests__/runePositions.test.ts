import { describe, expect, it } from 'vitest'
import { runeSideMap, shardsForTree, sideTreeCells } from '../runePositions'

describe('runeSideMap', () => {
  it('indexe primaire/secondaire par runeId', () => {
    const s = { games: 10, wins: 5, pickrate: 1, winrate: 50 }
    const z = { games: 0, wins: 0, pickrate: 0, winrate: 0 }
    const m = runeSideMap([{ runeId: 8126, primary: s, secondary: z }])
    expect(m[8126]?.primary.games).toBe(10)
    expect(m[8126]?.secondary.games).toBe(0)
    expect(runeSideMap(undefined)).toEqual({})
  })
})

describe('shardsForTree', () => {
  const rows = [
    { keystoneId: 8112, shardId: 5008, slot: 0, games: 30, wins: 15 },
    { keystoneId: 8128, shardId: 5005, slot: 0, games: 10, wins: 8 },
    { keystoneId: 8112, shardId: 5008, slot: 1, games: 40, wins: 20 },
    { keystoneId: 8005, shardId: 5008, slot: 0, games: 99, wins: 1 },
  ]

  it('garde les keystones de l’arbre et somme par shard/slot', () => {
    const r = shardsForTree(rows, [8112, 8128])
    expect(r.totalParticipants).toBe(40)
    const a = r.shards.find(s => s.shardId === 5008 && s.slot === 0)!
    expect(a.games).toBe(30)
    expect(a.pickrate).toBe(75)
    expect(a.winrate).toBe(50)
    expect(r.shards.some(s => s.games === 99)).toBe(false)
  })

  it('vide sans lignes', () => {
    expect(shardsForTree(undefined, [8112])).toEqual({ totalParticipants: 0, shards: [] })
  })
})

describe('sideTreeCells', () => {
  const s = (games: number) => ({ games, wins: games / 2, pickrate: 1, winrate: 50 })
  const cells = [
    { row: 0, col: 0, rune: { id: 8112 }, stats: null },
    { row: 1, col: 0, rune: { id: 8126 }, stats: null },
  ]
  const map = {
    8112: { primary: s(10), secondary: s(0) },
    8126: { primary: s(4), secondary: s(6) },
  }

  it('primaire : arbre entier, stats primaires', () => {
    const r = sideTreeCells(cells, map, 'primary')
    expect(r.map(c => c.rune.id)).toEqual([8112, 8126])
    expect(r[0]!.stats?.games).toBe(10)
  })

  it('secondaire : sans keystones, stats secondaires', () => {
    const r = sideTreeCells(cells, map, 'secondary')
    expect(r.map(c => c.rune.id)).toEqual([8126])
    expect(r[0]!.stats).toEqual({ games: 6, pickrate: 1, winrate: 50 })
  })

  it('stats null sans partie', () => {
    const r = sideTreeCells(cells, { 8112: { primary: s(0), secondary: s(0) } }, 'primary')
    expect(r[0]!.stats).toBeNull()
    expect(r[1]!.stats).toBeNull()
  })
})
