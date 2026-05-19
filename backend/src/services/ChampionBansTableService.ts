/**
 * Table des bans par champion, avec attribution au joueur (slot d'équipe) et au rôle du banneur.
 * Données lues depuis `champion_bans_by_banner` (fragment core, une ligne agrégée par champion).
 */
import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { buildRawMatchCond, sumMatchOutcomeCountUnionLiveArchive } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

export type ChampionBansTableRow = {
  championId: number
  bansTotal: number
  bansWhenTeamWon: number
  bansWhenTeamLost: number
  bansBlue: number
  bansRed: number
  bansTop: number
  bansJungle: number
  bansMiddle: number
  bansBottom: number
  bansSupport: number
}

function normalizeRoleFilter(role: string | null | undefined): string | null {
  if (role == null || role === '') return null
  const u = role.trim().toUpperCase()
  if (u === 'MID') return 'MIDDLE'
  if (u === 'ADC') return 'BOTTOM'
  if (u === 'UTILITY') return 'SUPPORT'
  return u
}

function bannerRoleBanCountExpr(bannerRole: string | null): string {
  const r = normalizeRoleFilter(bannerRole)
  if (r === 'TOP') return 'mv.count_banner_top'
  if (r === 'JUNGLE') return 'mv.count_banner_jungle'
  if (r === 'MIDDLE') return 'mv.count_banner_mid'
  if (r === 'BOTTOM') return 'mv.count_banner_adc'
  if (r === 'SUPPORT') return 'mv.count_banner_support'
  return 'mv.ban_count'
}

export async function getChampionBansTable(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ matchCount: number; rows: ChampionBansTableRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const mvFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner_core', version, 'mv')
  const csFrom = await matchVersionedAggFrom('agg_champion_side_stats', version, 'cs')
  const roleFilter = normalizeRoleFilter(role)
  const banTotalExpr = bannerRoleBanCountExpr(roleFilter)
  const rolePlayedCond =
    roleFilter != null
      ? `AND EXISTS (
          SELECT 1
          FROM ${csFrom}
          WHERE cs.champion_id = mv.banned_champion_id
            AND ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')}
            AND upper(cs.role::text) = '${roleFilter.replace(/'/g, "''")}'
            AND cs.count_game > 0
        )`
      : ''

  const matchCount = await sumMatchOutcomeCountUnionLiveArchive(version, rankTier)
  if (matchCount === 0) {
    return { matchCount: 0, rows: [] }
  }

  const mvWhere = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')

  const sql = `
    SELECT
      mv.banned_champion_id::int AS champion_id,
      SUM(${banTotalExpr})::int AS bans_total,
      SUM(mv.count_ban_when_team_won)::int AS bans_when_team_won,
      SUM(mv.count_ban_when_team_lost)::int AS bans_when_team_lost,
      SUM(mv.count_banner_team_100)::int AS bans_blue,
      SUM(mv.count_banner_team_200)::int AS bans_red,
      SUM(mv.count_banner_top)::int AS bans_top,
      SUM(mv.count_banner_jungle)::int AS bans_jungle,
      SUM(mv.count_banner_mid)::int AS bans_middle,
      SUM(mv.count_banner_adc)::int AS bans_bottom,
      SUM(mv.count_banner_support)::int AS bans_support
    FROM ${mvFrom}
    WHERE ${mvWhere}
    ${rolePlayedCond}
    GROUP BY mv.banned_champion_id
    HAVING SUM(${banTotalExpr}) > 0
    ORDER BY bans_total DESC, champion_id ASC
  `

  type SqlRow = {
    champion_id: number
    bans_total: number
    bans_when_team_won: number
    bans_when_team_lost: number
    bans_blue: number
    bans_red: number
    bans_top: number
    bans_jungle: number
    bans_middle: number
    bans_bottom: number
    bans_support: number
  }

  const raw = await queryRawUnsafe<SqlRow[]>(sql)
  const rows: ChampionBansTableRow[] = raw.map((r) => ({
    championId: Number(r.champion_id),
    bansTotal: Number(r.bans_total),
    bansWhenTeamWon: Number(r.bans_when_team_won),
    bansWhenTeamLost: Number(r.bans_when_team_lost),
    bansBlue: Number(r.bans_blue),
    bansRed: Number(r.bans_red),
    bansTop: Number(r.bans_top),
    bansJungle: Number(r.bans_jungle),
    bansMiddle: Number(r.bans_middle),
    bansBottom: Number(r.bans_bottom),
    bansSupport: Number(r.bans_support),
  }))

  return { matchCount, rows }
}
