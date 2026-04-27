import { prisma, isDatabaseConfigured } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
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
} | null> {
  if (!isDatabaseConfigured() || championId <= 0) return null

  const versions = toQueryStringArrayParam(version).map((v) => v.trim()).filter(Boolean)
  const tiers = toQueryStringArrayParam(rankTier)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
  const roleRaw = String(role ?? '').trim().toUpperCase()
  const roleNorm =
    roleRaw === 'MID' ? 'MIDDLE' : roleRaw === 'ADC' ? 'BOTTOM' : roleRaw === 'UTILITY' ? 'SUPPORT' : roleRaw

  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', versions, 'ac')
  const damageFrom = await matchVersionedAggFrom('agg_champion_damage_stats', versions, 'ad')

  const where: string[] = [`ac.champion_id = ${Number(championId)}`]
  if (versions.length === 1) where.push(`ac.game_version LIKE '${esc(versions[0]!)}%'`)
  else if (versions.length > 1)
    where.push(`ac.game_version IN (${versions.map((v) => `'${esc(v)}'`).join(', ')})`)
  if (tiers.length === 1) where.push(`ac.rank_tier = '${esc(tiers[0]!)}'`)
  else if (tiers.length > 1) where.push(`ac.rank_tier IN (${tiers.map((t) => `'${esc(t)}'`).join(', ')})`)
  else where.push(`ac.rank_tier <> 'UNRANKED'`)
  if (roleNorm) where.push(`ac.role = '${esc(roleNorm)}'`)

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      games: number
      sum_phys: number
      sum_magic: number
      sum_true: number
      sum_total: number
    }>
  >(`
    SELECT
      COALESCE(SUM(ad.count_game), 0)::int AS games,
      COALESCE(SUM(ad.sum_physical_damage_to_champions), 0)::bigint AS sum_phys,
      COALESCE(SUM(ad.sum_magic_damage_to_champions), 0)::bigint AS sum_magic,
      COALESCE(SUM(ad.sum_true_damage_to_champions), 0)::bigint AS sum_true,
      COALESCE(SUM(ad.sum_total_damage_to_champions), 0)::bigint AS sum_total
    FROM ${coreFrom}
    INNER JOIN ${damageFrom} ON ad.champion_stat_id = ac.id
    WHERE ${where.join(' AND ')}
  `)

  const row = rows[0]
  const games = Number(row?.games ?? 0)
  const sumPhys = Number(row?.sum_phys ?? 0)
  const sumMagic = Number(row?.sum_magic ?? 0)
  const sumTrue = Number(row?.sum_true ?? 0)
  const sumTotalRaw = Number(row?.sum_total ?? 0)
  const sumTotal = sumTotalRaw > 0 ? sumTotalRaw : sumPhys + sumMagic + sumTrue
  const div = games > 0 ? games : 1
  const round1 = (n: number) => Math.round(n * 10) / 10

  return {
    championId,
    games,
    avgPhysicalDamageToChampions: round1(sumPhys / div),
    avgMagicDamageToChampions: round1(sumMagic / div),
    avgTrueDamageToChampions: round1(sumTrue / div),
    avgTotalDamageToChampions: round1(sumTotal / div),
  }
}

