/**
 * Summoner spell stats by champion from champion_summoner_spells_agg aggregate table.
 * Individual spell stats from MV; duos from agg_champion_summoner_spell_pair_stats.
 */
import { queryRawUnsafe } from '../db/query.js'
import { isDatabaseConfigured } from '../db/query.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor } from './statsAggArchive.js'

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
  rankTier: string | string[] | null,
  role?: string | null
): Promise<{ statIds: bigint[]; totalGames: number }> {
  const filters: string[] = [`champion_id = ${championId}`]
  if (pVersion) filters.push(`game_version LIKE '${normalizePatchMajorMinor(pVersion).replace(/'/g, "''")}%'`)
  const pRole = norm(role)?.toUpperCase()
  if (pRole) filters.push(`role = '${pRole.replace(/'/g, "''")}'`)
  const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
  if (ranks.length === 1) filters.push(`rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    filters.push(`rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  } else {
    filters.push(`rank_tier <> 'UNRANKED'`)
  }

  const whereSql = filters.join(' AND ')
  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', pVersion, 'cc')
  const coreStats = await queryRawUnsafe<Array<{ id: bigint; countGame: number }>>(`
    SELECT
      id,
      count_game AS "countGame"
    FROM ${coreFrom}
    WHERE ${whereSql}
  `)
  const totalGames = coreStats.reduce((sum, r) => sum + Number(r.countGame ?? 0), 0)
  const statIds = coreStats.map((s) => s.id)
  return { statIds, totalGames }
}

export async function getSummonerSpellsByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ totalGames: number; spells: SummonerSpellRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = norm(version)

  try {
    const { statIds, totalGames } = await getChampionStatIds(
      championId,
      pVersion,
      rankTier ?? null,
      role ?? null
    )
    if (statIds.length === 0) return { totalGames: 0, spells: [] }

    const spellsFrom = await matchVersionedAggFrom('agg_champion_summoner_spells', pVersion, 'ss')

    const spellRows = await queryRawUnsafe<
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
      FROM ${spellsFrom}
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
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ totalGames: number; duos: SummonerSpellDuoRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = norm(version)

  try {
    const pRole = norm(role)?.toUpperCase()
    const { totalGames } = await getChampionStatIds(championId, pVersion, rankTier ?? null, pRole)
    const versionClause = pVersion
      ? `AND sp.game_version LIKE '${normalizePatchMajorMinor(pVersion).replace(/'/g, "''")}%'`
      : ''
    const ranks = toQueryStringArrayParam(rankTier).map((r) => r.toUpperCase())
    const rankClause =
      ranks.length === 1
        ? `AND sp.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`
        : ranks.length > 1
          ? `AND sp.rank_tier IN (${ranks.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')})`
          : `AND sp.rank_tier <> 'UNRANKED'`
    const roleClause = pRole ? `AND UPPER(sp.role) = '${pRole.replace(/'/g, "''")}'` : ''
    const pairFrom = await matchVersionedAggFrom('agg_champion_summoner_spell_pair_stats', pVersion, 'sp')
    const pairRows = await queryRawUnsafe<
      Array<{ spellId1: number; spellId2: number; games: bigint; wins: bigint }>
    >(`
      SELECT
        sp.spell_d AS "spellId1",
        sp.spell_f AS "spellId2",
        SUM(sp.count_game)::bigint AS games,
        SUM(sp.count_win)::bigint AS wins
      FROM ${pairFrom}
      WHERE sp.champion_id = ${championId}
        ${versionClause}
        ${rankClause}
        ${roleClause}
      GROUP BY sp.spell_d, sp.spell_f
      HAVING SUM(sp.count_game) >= 100
      ORDER BY SUM(sp.count_game) DESC
      LIMIT 50
    `)
    const duos: SummonerSpellDuoRow[] = pairRows.map((r) => {
      const games = Number(r.games ?? 0)
      const wins = Number(r.wins ?? 0)
      return {
        spellId1: Number(r.spellId1),
        spellId2: Number(r.spellId2),
        games,
        wins,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
      }
    })
    return { totalGames, duos }
  } catch (err) {
    console.warn('[getSummonerSpellsDuosByChampion]', err)
    return null
  }
}
