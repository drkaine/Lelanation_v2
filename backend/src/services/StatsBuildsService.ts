/**
 * Builds stats by champion: most played builds, best winrate (from participants).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface BuildRow {
  items: number[]
  games: number
  wins: number
  winrate: number
  pickrate: number
}

export interface BuildsByChampionOptions {
  championId: number
  rankTier?: string | null
  role?: string | null
  patch?: string | null
  minGames?: number
  limit?: number
}

function itemsKey(items: number[] | null): string {
  if (!items || !Array.isArray(items)) return '[]'
  const sorted = [...items].filter((x) => typeof x === 'number').sort((a, b) => a - b)
  return JSON.stringify(sorted)
}

export async function getBuildsByChampion(
  options: BuildsByChampionOptions
): Promise<{ totalGames: number; builds: BuildRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const { championId, rankTier, role, patch, minGames = 10, limit = 20 } = options
  try {
    const where: { championId: number; rankTier?: string | null; role?: string | null } = {
      championId,
    }
    if (rankTier != null && rankTier !== '') where.rankTier = rankTier
    if (role != null && role !== '') where.role = role

    const participants = await prisma.participant.findMany({
      where,
      select: {
        items: true,
        win: true,
        matchId: true,
      },
    })

    if (participants.length === 0) {
      return { totalGames: 0, builds: [] }
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
    if (totalGames === 0) return { totalGames: 0, builds: [] }

    const byKey = new Map<string, { games: number; wins: number }>()
    for (const p of filtered) {
      const raw = p.items
      const arr = Array.isArray(raw) ? (raw as number[]) : []
      const key = itemsKey(arr)
      const entry = byKey.get(key) ?? { games: 0, wins: 0 }
      entry.games++
      if (p.win) entry.wins++
      byKey.set(key, entry)
    }

    let builds: BuildRow[] = []
    for (const [key, e] of byKey) {
      if (e.games < minGames) continue
      const items: number[] = JSON.parse(key)
      builds.push({
        items,
        games: e.games,
        wins: e.wins,
        winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
        pickrate: totalGames > 0 ? Math.round((e.games / totalGames) * 10000) / 100 : 0,
      })
    }
    builds.sort((a, b) => b.games - a.games)
    let limited = builds.slice(0, limit)

    // When no build meets minGames but we have data, return top builds with at least 1 game
    if (limited.length === 0 && totalGames > 0) {
      builds = []
      for (const [key, e] of byKey) {
        if (e.games < 1) continue
        const items: number[] = JSON.parse(key)
        builds.push({
          items,
          games: e.games,
          wins: e.wins,
          winrate: e.games > 0 ? Math.round((e.wins / e.games) * 10000) / 100 : 0,
          pickrate: totalGames > 0 ? Math.round((e.games / totalGames) * 10000) / 100 : 0,
        })
      }
      builds.sort((a, b) => b.games - a.games)
      limited = builds.slice(0, limit)
    }

    return { totalGames, builds: limited }
  } catch {
    return null
  }
}
