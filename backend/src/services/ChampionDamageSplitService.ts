import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildChampionScopedWhere } from './ChampionGlobalTableService.js'
import { toQueryStringArrayParam, normalizeStatsRoleForChampion } from '../utils/statsFilters.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

function esc(v: string): string {
  return v.replace(/'/g, "''")
}

export async function getChampionDamageSplit(
  championId: number,
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null,
): Promise<{
  championId: number
  games: number
  avgPhysicalDamageToChampions: number
  avgMagicDamageToChampions: number
  avgTrueDamageToChampions: number
  avgTotalDamageToChampions: number
  avgDamageToChampions: number
  avgDamageToObjectives: number
  avgDamageToBuildings: number
  avgDamageToNeutralMonsters: number
  avgDamageToMinions: number
} | null> {
  if (!isDatabaseConfigured() || championId <= 0) return null

  const versions = toQueryStringArrayParam(version).map((v) => v.trim()).filter(Boolean)
  const tiers = toQueryStringArrayParam(rankTier)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
  const roleRaw = String(role ?? '').trim().toUpperCase()
  const roleNorm =
    roleRaw === 'MID' ? 'MIDDLE' : roleRaw === 'ADC' ? 'BOTTOM' : roleRaw === 'UTILITY' ? 'SUPPORT' : roleRaw

  /** Même source que le tableau global : agg_champion_side_stats (dégâts infligés aux champions). */
  const sideFrom = await matchVersionedAggFrom('agg_champion_side_stats', versions, 'mv')

  const where: string[] = [`mv.champion_id = ${Number(championId)}`]
  if (versions.length === 1) where.push(`mv.game_version LIKE '${esc(versions[0]!)}%'`)
  else if (versions.length > 1)
    where.push(`mv.game_version IN (${versions.map((v) => `'${esc(v)}'`).join(', ')})`)
  if (tiers.length === 1) where.push(`mv.rank_tier = '${esc(tiers[0]!)}'`)
  else if (tiers.length > 1) where.push(`mv.rank_tier IN (${tiers.map((t) => `'${esc(t)}'`).join(', ')})`)
  else where.push(`mv.rank_tier <> 'UNRANKED'`)
  if (roleNorm) where.push(`mv.role = '${esc(roleNorm)}'`)

  const rows = await queryRawUnsafe<
    Array<{
      games: number
      sum_phys: number
      sum_magic: number
      sum_true: number
      sum_total: number
    }>
  >(`
    SELECT
      COALESCE(SUM(mv.count_game), 0)::int AS games,
      COALESCE(SUM(mv.sum_physical_damage_to_champions), 0)::bigint AS sum_phys,
      COALESCE(SUM(mv.sum_magic_damage_to_champions), 0)::bigint AS sum_magic,
      COALESCE(SUM(mv.sum_true_damage_to_champions), 0)::bigint AS sum_true,
      COALESCE(SUM(mv.sum_total_damage_dealt_to_champions), 0)::bigint AS sum_total
    FROM ${sideFrom}
    WHERE ${where.join(' AND ')}
  `)

  const row = rows[0]
  const games = Number(row?.games ?? 0)
  if (games <= 0) return null
  const sumPhys = Number(row?.sum_phys ?? 0)
  const sumMagic = Number(row?.sum_magic ?? 0)
  const sumTrue = Number(row?.sum_true ?? 0)
  const sumTotalRaw = Number(row?.sum_total ?? 0)
  const sumTotal = sumTotalRaw > 0 ? sumTotalRaw : sumPhys + sumMagic + sumTrue
  const div = games > 0 ? games : 1
  const round1 = (n: number) => Math.round(n * 10) / 10

  const versionsArr = versions
  const tiersArr = tiers
  const csFrom = await matchVersionedAggFrom(
    'agg_champion_team_objective_stats',
    versionsArr.length ? versionsArr : null,
    'cs'
  )
  const csWhere = buildChampionScopedWhere('cs', {
    championId,
    version: versionsArr.length ? versionsArr : null,
    rankTier: tiersArr.length ? tiersArr : null,
    role: normalizeStatsRoleForChampion(role ?? null),
  })
  const targetRows = await queryRawUnsafe<
    Array<{
      games: number
      sum_champs: bigint
      sum_objectives: bigint
      sum_buildings: bigint
      sum_epic: bigint
      sum_total_done: bigint
    }>
  >(`
    SELECT
      COALESCE(SUM(cs.count_game), 0)::int AS games,
      COALESCE(SUM(
        cs.sum_physical_damage_done_to_champions
        + cs.sum_magic_damage_done_to_champions
        + cs.sum_true_damage_done_to_champions
      ), 0)::bigint AS sum_champs,
      COALESCE(SUM(cs.sum_damage_dealt_to_objectives), 0)::bigint AS sum_objectives,
      COALESCE(SUM(cs.sum_damage_dealt_to_buildings), 0)::bigint AS sum_buildings,
      COALESCE(SUM(cs.sum_damage_dealt_to_epic_monsters), 0)::bigint AS sum_epic,
      COALESCE(SUM(
        cs.sum_physical_damage_done
        + cs.sum_magic_damage_done
        + cs.sum_true_damage_done
      ), 0)::bigint AS sum_total_done
    FROM ${csFrom}
    WHERE ${csWhere}
  `)
  const tRow = targetRows[0]
  const tGames = Number(tRow?.games ?? 0) || games
  const tDiv = tGames > 0 ? tGames : 1
  const sumChamps = Number(tRow?.sum_champs ?? 0)
  const sumObj = Number(tRow?.sum_objectives ?? 0)
  const sumBld = Number(tRow?.sum_buildings ?? 0)
  const sumEpic = Number(tRow?.sum_epic ?? 0)
  const sumTotalDone = Number(tRow?.sum_total_done ?? 0)
  const sumObjNet = Math.max(0, sumObj - sumEpic)
  const sumMinions = Math.max(0, sumTotalDone - sumChamps - sumBld - sumObj)

  return {
    championId,
    games,
    avgPhysicalDamageToChampions: round1(sumPhys / div),
    avgMagicDamageToChampions: round1(sumMagic / div),
    avgTrueDamageToChampions: round1(sumTrue / div),
    avgTotalDamageToChampions: round1(sumTotal / div),
    avgDamageToChampions: round1(sumChamps / tDiv),
    avgDamageToObjectives: round1(sumObjNet / tDiv),
    avgDamageToBuildings: round1(sumBld / tDiv),
    avgDamageToNeutralMonsters: round1(sumEpic / tDiv),
    avgDamageToMinions: round1(sumMinions / tDiv),
  }
}

