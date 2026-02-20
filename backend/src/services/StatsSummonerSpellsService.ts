/**
 * Stats sorts d'invocateur par champion : par sort (pickrate, winrate) et en duos (paires de sorts).
 */
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'

export interface SummonerSpellRow {
  spellId: number
  games: number
  wins: number
  pickrate: number
  winrate: number
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

/**
 * Sorts d'invocateur pour un champion : chaque sort avec games, wins, pickrate, winrate.
 * Filtres version (match.game_version) et rankTier (participant.rank_tier).
 */
export async function getSummonerSpellsByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | null
): Promise<{ totalGames: number; spells: SummonerSpellRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = norm(version)
  const pRankTier = norm(rankTier)
  const versionPrefix = pVersion ? `${pVersion}%` : '%'
  const rankFilter = pRankTier ? 'AND p.rank_tier = $3' : ''
  const params: unknown[] = [championId, versionPrefix]
  if (pRankTier) params.push(pRankTier)

  try {
    const totalRow = await prisma.$queryRawUnsafe<[{ total: string }]>(
      `SELECT COUNT(*)::text AS total
       FROM participants p
       INNER JOIN matches m ON m.id = p.match_id
       WHERE p.champion_id = $1 AND m.game_version LIKE $2 ${rankFilter}`,
      ...params
    )
    const totalGames = Number(totalRow[0]?.total ?? 0)
    if (totalGames === 0) return { totalGames: 0, spells: [] }

    const rows = await prisma.$queryRawUnsafe<
      Array<{ spell_id: string; games: string; wins: string }>
    >(
      `WITH base AS (
         SELECT p.win, jsonb_array_elements_text(COALESCE(p.summoner_spells, '[]'::jsonb))::int AS spell_id
         FROM participants p
         INNER JOIN matches m ON m.id = p.match_id
         WHERE p.champion_id = $1 AND m.game_version LIKE $2 ${rankFilter}
       )
       SELECT spell_id::text AS spell_id, COUNT(*)::text AS games, SUM(CASE WHEN win THEN 1 ELSE 0 END)::text AS wins
       FROM base
       GROUP BY spell_id
       ORDER BY games DESC`,
      ...params
    )
    const spells: SummonerSpellRow[] = rows.map(r => {
      const games = Number(r.games)
      const wins = Number(r.wins)
      return {
        spellId: Number(r.spell_id),
        games,
        wins,
        pickrate: (games / totalGames) * 100,
        winrate: games ? (wins / games) * 100 : 0,
      }
    })
    return { totalGames, spells }
  } catch (err) {
    console.warn('[getSummonerSpellsByChampion]', err)
    return null
  }
}

/**
 * Duos de sorts pour un champion : paires (spellId1, spellId2) en ordre canonique (min, max), games, wins, winrate.
 */
export async function getSummonerSpellsDuosByChampion(
  championId: number,
  version?: string | null,
  rankTier?: string | null
): Promise<{ totalGames: number; duos: SummonerSpellDuoRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const pVersion = norm(version)
  const pRankTier = norm(rankTier)
  const versionPrefix = pVersion ? `${pVersion}%` : '%'
  const rankFilter = pRankTier ? 'AND p.rank_tier = $3' : ''
  const params: unknown[] = [championId, versionPrefix]
  if (pRankTier) params.push(pRankTier)

  try {
    const totalRow = await prisma.$queryRawUnsafe<[{ total: string }]>(
      `SELECT COUNT(*)::text AS total
       FROM participants p
       INNER JOIN matches m ON m.id = p.match_id
       WHERE p.champion_id = $1 AND m.game_version LIKE $2
         AND p.summoner_spells IS NOT NULL AND jsonb_array_length(p.summoner_spells) >= 2 ${rankFilter}`,
      ...params
    )
    const totalGames = Number(totalRow[0]?.total ?? 0)
    if (totalGames === 0) return { totalGames: 0, duos: [] }

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id1: string; id2: string; games: string; wins: string }>
    >(
      `WITH base AS (
         SELECT p.win,
                LEAST((p.summoner_spells->>0)::int, (p.summoner_spells->>1)::int) AS id1,
                GREATEST((p.summoner_spells->>0)::int, (p.summoner_spells->>1)::int) AS id2
         FROM participants p
         INNER JOIN matches m ON m.id = p.match_id
         WHERE p.champion_id = $1 AND m.game_version LIKE $2
           AND p.summoner_spells IS NOT NULL AND jsonb_array_length(p.summoner_spells) >= 2 ${rankFilter}
       )
       SELECT id1::text AS id1, id2::text AS id2, COUNT(*)::text AS games, SUM(CASE WHEN win THEN 1 ELSE 0 END)::text AS wins
       FROM base
       GROUP BY id1, id2
       ORDER BY games DESC
       LIMIT 50`,
      ...params
    )
    const duos: SummonerSpellDuoRow[] = rows.map(r => {
      const games = Number(r.games)
      const wins = Number(r.wins)
      return {
        spellId1: Number(r.id1),
        spellId2: Number(r.id2),
        games,
        wins,
        winrate: games ? (wins / games) * 100 : 0,
      }
    })
    return { totalGames, duos }
  } catch (err) {
    console.warn('[getSummonerSpellsDuosByChampion]', err)
    return null
  }
}
