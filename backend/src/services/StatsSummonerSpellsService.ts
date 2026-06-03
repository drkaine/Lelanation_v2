/**
 * Summoner spell stats by champion from champion_summoner_spells and pair stats tables.
 */
import { queryRawUnsafe } from '../db/query.js'
import { isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere, sumChampionCoreGames } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

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

export async function getSummonerSpellsByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ totalGames: number; spells: SummonerSpellRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = norm(version)
  const pRole = norm(role)

  try {
    const totalGames = await sumChampionCoreGames({
      championId,
      version: pVersion,
      rankTier: rankTier ?? null,
      role: pRole,
    })
    if (totalGames <= 0) return { totalGames: 0, spells: [] }

    const spellsFrom = await matchVersionedAggFrom('agg_champion_summoner_spells', pVersion, 'ss')
    const whereSql = buildChampionScopedWhere('ss', {
      championId,
      version: pVersion,
      rankTier: rankTier ?? null,
      role: pRole,
    })

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
        ss.spell_id AS "spellId",
        SUM(ss.count_win)::integer AS "countWin",
        SUM(ss.count_game)::integer AS "countGame",
        SUM(ss.count_slot0)::integer AS "countSlot0",
        SUM(ss.count_slot1)::integer AS "countSlot1"
      FROM ${spellsFrom}
      WHERE ${whereSql}
      GROUP BY ss.spell_id
    `)

    const spells: SummonerSpellRow[] = spellRows.map((row) => {
      const games = Number(row.countGame ?? 0)
      const wins = Number(row.countWin ?? 0)
      return {
        spellId: row.spellId,
        games,
        wins,
        pickrate: totalGames > 0 ? Math.round((games / totalGames) * 10000) / 100 : 0,
        winrate: games > 0 ? Math.round((wins / games) * 10000) / 100 : 0,
        countSlot0: Number(row.countSlot0 ?? 0),
        countSlot1: Number(row.countSlot1 ?? 0),
      }
    })
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
  const pRole = norm(role)

  try {
    const totalGames = await sumChampionCoreGames({
      championId,
      version: pVersion,
      rankTier: rankTier ?? null,
      role: pRole,
    })
    const whereSql = buildChampionScopedWhere('sp', {
      championId,
      version: pVersion,
      rankTier: rankTier ?? null,
      role: pRole,
    })
    const pairFrom = await matchVersionedAggFrom(
      'agg_champion_summoner_spell_pair_stats',
      pVersion,
      'sp',
    )
    const pairRows = await queryRawUnsafe<
      Array<{ spellId1: number; spellId2: number; games: bigint; wins: bigint }>
    >(`
      SELECT
        sp.spell_d AS "spellId1",
        sp.spell_f AS "spellId2",
        SUM(sp.count_game)::bigint AS games,
        SUM(sp.count_win)::bigint AS wins
      FROM ${pairFrom}
      WHERE ${whereSql}
      GROUP BY sp.spell_d, sp.spell_f
      HAVING SUM(sp.count_game) >= 10
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
