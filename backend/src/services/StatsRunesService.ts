/**
 * Runes stats by champion: most played setups, best winrate (from participants).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface RuneRow {
  runes: unknown
  games: number
  wins: number
  winrate: number
  pickrate: number
}

export interface RunesByChampionOptions {
  championId: number
  rankTier?: string | null
  patch?: string | null
  minGames?: number
  limit?: number
}

function runesKey(runes: unknown): string {
  if (runes == null) return 'null'
  try {
    return JSON.stringify(runes)
  } catch {
    return 'null'
  }
}

export async function getRunesByChampion(
  options: RunesByChampionOptions
): Promise<{ totalGames: number; runes: RuneRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, rankTier, patch, minGames = 10, limit = 20 } = options
  try {
    const where: { championId: number; rankTier?: string | null } = { championId }
    if (rankTier != null && rankTier !== '') where.rankTier = rankTier

    const participants = await prisma.participant.findMany({
      where,
      select: { runes: true, win: true, matchId: true },
    })

    if (participants.length === 0) {
      return { totalGames: 0, runes: [] }
    }

    const matchIds = [...new Set(participants.map((p) => p.matchId))]
    let matchFilter: { id: bigint }[] | null = null
    if (patch != null && patch !== '') {
      const matches = await prisma.match.findMany({
        where: { id: { in: matchIds }, gameVersion: { contains: patch, mode: 'insensitive' } },
        select: { id: true },
      })
      matchFilter = matches
    }
    const filtered =
      matchFilter != null && matchFilter.length > 0
        ? participants.filter((p) => matchFilter!.some((m) => m.id === p.matchId))
        : participants
    const totalGames = filtered.length
    if (totalGames === 0) return { totalGames: 0, runes: [] }

    const byKey = new Map<string, { games: number; wins: number; runes: unknown }>()
    for (const p of filtered) {
      const key = runesKey(p.runes)
      let entry = byKey.get(key)
      if (!entry) {
        entry = { games: 0, wins: 0, runes: p.runes }
        byKey.set(key, entry)
      }
      entry.games++
      if (p.win) entry.wins++
    }

    const runes: RuneRow[] = []
    for (const [, e] of byKey) {
      if (e.games < minGames) continue
      runes.push({
        runes: e.runes,
        games: e.games,
        wins: e.wins,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        pickrate: totalGames > 0 ? Math.round((e.games / totalGames) * 10000) / 100 : 0,
      })
    }
    runes.sort((a, b) => b.games - a.games)
    const limited = runes.slice(0, limit)
    return { totalGames, runes: limited }
  } catch {
    return null
  }
}
