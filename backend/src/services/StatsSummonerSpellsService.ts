/**
 * Summoner spell stats by champion from champion_summoner_spells_agg aggregate table.
 * Individual spell stats from MV; duos from raw ingest_match_players.summoner_spells.
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'

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
  const filters: string[] = [`champion_id = ${championId}`]
  if (pVersion) filters.push(`game_version LIKE '${pVersion.replace(/'/g, "''")}%'`)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) filters.push(`rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    filters.push(`rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  } else {
    filters.push(`rank_tier <> 'UNRANKED'`)
  }

  const whereSql = filters.join(' AND ')
  const coreStats = await prisma.$queryRawUnsafe<Array<{ id: bigint; countGame: number }>>(`
    SELECT
      id,
      count_game AS "countGame"
    FROM agg_champion_core_stats
    WHERE ${whereSql}
  `)
  const totalGames = coreStats.reduce((sum, r) => sum + Number(r.countGame ?? 0), 0)
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

    const spellRows = await prisma.$queryRawUnsafe<
      Array<{
        spellId: number
        countWin: number
        countGame: number
        countSlot0: number
        countSlot1: number
      }>
    >(`
      SELECT
        spell_id AS "spellId",
        count_win AS "countWin",
        count_game AS "countGame",
        count_slot0 AS "countSlot0",
        count_slot1 AS "countSlot1"
      FROM agg_champion_summoner_spells
      WHERE champion_stat_id IN (${statIds.map((id) => id.toString()).join(',')})
    `)

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

    // Duos from ingest_match_players.summoner_spells (ordered D/F)
    const versionClause = pVersion
      ? `AND m.game_version LIKE '${pVersion.replace(/'/g, "''")}%'`
      : ''
    const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
    const rankClause =
      ranks.length === 1
        ? `AND COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(m.rank_tier, ''), 'UNRANKED') = '${ranks[0]!.replace(/'/g, "''")}'`
        : ranks.length > 1
          ? `AND COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(m.rank_tier, ''), 'UNRANKED') IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`
          : `AND COALESCE(NULLIF(imp.rank_tier, ''), NULLIF(m.rank_tier, ''), 'UNRANKED') <> 'UNRANKED'`

    const matchPlayersRows = await prisma.$queryRawUnsafe<
      Array<{ win: boolean; summonerSpells: number[] }>
    >(`
      SELECT
        it.win AS win,
        imp.summoner_spells AS "summonerSpells"
      FROM ingest_match_players imp
      INNER JOIN ingest_matchs m ON m.id = imp.match_id
      INNER JOIN ingest_teams it ON it.id = imp.team_id
      WHERE imp.champion_id = ${championId}
        ${versionClause}
        ${rankClause}
      LIMIT 50000
    `)

    const totalGamesRaw = matchPlayersRows.length
    if (totalGamesRaw === 0) return { totalGames: totalGames, duos: [] }

    const duoMap = new Map<string, { id1: number; id2: number; games: number; wins: number }>()
    for (const mp of matchPlayersRows) {
      const spellIds = [...mp.summonerSpells].sort((a, b) => a - b)
      if (spellIds.length < 2) continue
      const id1 = spellIds[0]
      const id2 = spellIds[1]
      const key = `${id1}:${id2}`
      const win = mp.win ?? false
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
