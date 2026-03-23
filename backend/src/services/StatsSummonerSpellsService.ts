/**
 * Summoner spell stats by champion from champion_summoner_spells_agg aggregate table.
 * Individual spell stats from MV; duos from raw match_players.summoner_spells.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { applyRankTierWhere } from '../utils/statsFilters.js'

export interface SummonerSpellRow {
  spellId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
  countSlot0?: number
  countSlot1?: number
}

export interface SummonerSpellDuoRow {
  spellId1: number
  spellId2: number
  games: number
  wins: number
  winrate: number
}

function norm(value: string | string[] | null | undefined): string | null {
  if (value == null) return null
  const s = Array.isArray(value) ? value[0] : value
  if (typeof s !== 'string' || s === '' || s.startsWith('[')) return null
  return s
}

async function getChampionStatIds(
  championId: number,
  pVersion: string | null,
  rankTier: string | string[] | null
): Promise<{ statIds: bigint[]; totalGames: number }> {
  const coreWhere: Record<string, unknown> = { championId }
  if (pVersion) coreWhere.gameVersion = pVersion
  applyRankTierWhere(coreWhere, rankTier)

  const coreStats = await prisma.mvChampionCoreStat.findMany({
    where: coreWhere,
    select: { id: true, countGame: true },
  })
  const totalGames = coreStats.reduce((sum, r) => sum + r.countGame, 0)
  const statIds = coreStats.map((s) => s.id)
  return { statIds, totalGames }
}

export async function getSummonerSpellsByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | string[] | null
): Promise<{ totalGames: number; spells: SummonerSpellRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = norm(version)

  try {
    const { statIds, totalGames } = await getChampionStatIds(championId, pVersion, rankTier ?? null)
    if (statIds.length === 0) return { totalGames: 0, spells: [] }

    const spellRows = await prisma.mvChampionSummonerSpellAgg.findMany({
      where: { championStatId: { in: statIds } },
      select: {
        spellId: true,
        countWin: true,
        countGame: true,
        countSlot0: true,
        countSlot1: true,
      },
    })

    const bySpell = new Map<
      number,
      { wins: number; games: number; slot0: number; slot1: number }
    >()
    for (const row of spellRows) {
      const sid = row.spellId
      let entry = bySpell.get(sid)
      if (!entry) {
        entry = { wins: 0, games: 0, slot0: 0, slot1: 0 }
        bySpell.set(sid, entry)
      }
      entry.wins += row.countWin
      entry.games += row.countGame
      entry.slot0 += row.countSlot0
      entry.slot1 += row.countSlot1
    }

    const spells: SummonerSpellRow[] = []
    for (const [spellId, entry] of bySpell.entries()) {
      spells.push({
        spellId,
        games: entry.games,
        wins: entry.wins,
        pickrate: totalGames > 0 ? Math.round((entry.games / totalGames) * 10000) / 100 : 0,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
        countSlot0: entry.slot0,
        countSlot1: entry.slot1,
      })
    }
    spells.sort((a, b) => b.games - a.games)

    return { totalGames, spells }
  } catch (err) {
    console.warn('[getSummonerSpellsByChampion]', err)
    return null
  }
}

export async function getSummonerSpellsDuosByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | string[] | null
): Promise<{ totalGames: number; duos: SummonerSpellDuoRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = norm(version)

  try {
    const { statIds, totalGames } = await getChampionStatIds(championId, pVersion, rankTier ?? null)
    if (statIds.length === 0) return { totalGames: 0, duos: [] }

    // Duos from match_players.summoner_spells (ordered D/F)
    const matchRankWhere: Record<string, unknown> = {}
    if (pVersion) matchRankWhere.gameVersion = pVersion
    applyRankTierWhere(matchRankWhere, rankTier)

    // Get match_player IDs for this champion with filters
    const matchPlayersRows = await prisma.matchPlayer.findMany({
      where: {
        championId,
        match: matchRankWhere,
      },
      select: {
        id: true,
        team: { select: { win: true } },
        summonerSpells: true,
      },
      take: 50000,
    })

    const totalGamesRaw = matchPlayersRows.length
    if (totalGamesRaw === 0) return { totalGames: totalGames, duos: [] }

    const duoMap = new Map<string, { id1: number; id2: number; games: number; wins: number }>()
    for (const mp of matchPlayersRows) {
      const spellIds = [...mp.summonerSpells].sort((a, b) => a - b)
      if (spellIds.length < 2) continue
      const id1 = spellIds[0]
      const id2 = spellIds[1]
      const key = `${id1}:${id2}`
      const win = mp.team?.win ?? false
      let entry = duoMap.get(key)
      if (!entry) {
        entry = { id1, id2, games: 0, wins: 0 }
        duoMap.set(key, entry)
      }
      entry.games++
      if (win) entry.wins++
    }

    const duos: SummonerSpellDuoRow[] = []
    for (const entry of duoMap.values()) {
      duos.push({
        spellId1: entry.id1,
        spellId2: entry.id2,
        games: entry.games,
        wins: entry.wins,
        winrate: entry.games > 0 ? Math.round((entry.wins / entry.games) * 10000) / 100 : 0,
      })
    }
    duos.sort((a, b) => b.games - a.games)
    duos.splice(50)

    return { totalGames, duos }
  } catch (err) {
    console.warn('[getSummonerSpellsDuosByChampion]', err)
    return null
  }
}
