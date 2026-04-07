/**
 * Table des bans par champion, avec attribution au joueur (slot d’équipe) et au rôle du banneur.
 * Données lues depuis la vue matérialisée `mv_champion_bans_by_banner` (définie en SQL migration).
 * Filtres patch / ligue alignés sur ChampionGlobalTableService.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { buildRawMatchCond } from './ChampionGlobalTableService.js'

export type ChampionBansTableRow = {
  championId: number
  bansTotal: number
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

export async function getChampionBansTable(
  version?: string | string[] | null,
  rankTier?: string | string[] | null,
  role?: string | null
): Promise<{ matchCount: number; rows: ChampionBansTableRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const matchCond = buildRawMatchCond(version, rankTier)
  const roleFilter = normalizeRoleFilter(role)
  /** Filtre rôle du banneur (colonne `banner_role_norm` dans la MV). */
  const roleCondMv =
    roleFilter != null
      ? `AND mv.banner_role_norm = '${roleFilter.replace(/'/g, "''")}'`
      : ''

  const matchCountRows = await prisma.$queryRawUnsafe<Array<{ mc: bigint }>>(
    `SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS mc
     FROM mv_match_outcome_stats mo
     WHERE ${matchCond.replace(/\bm\./g, 'mo.')}`
  )
  const matchCount = Math.max(0, Number(matchCountRows[0]?.mc ?? 0))
  if (matchCount === 0) {
    return { matchCount: 0, rows: [] }
  }

  /** Même prédicat que sur `matchs`, appliqué à l’alias `mv` (vue `mv_champion_bans_by_banner`). */
  const mvWhere = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'mv.')

  const sql = `
    SELECT
      mv.banned_champion_id::int AS champion_id,
      SUM(mv.ban_count)::int AS bans_total,
      SUM(mv.ban_count) FILTER (WHERE mv.team_num = 100)::int AS bans_blue,
      SUM(mv.ban_count) FILTER (WHERE mv.team_num = 200)::int AS bans_red,
      SUM(mv.ban_count) FILTER (WHERE mv.banner_role_norm = 'TOP')::int AS bans_top,
      SUM(mv.ban_count) FILTER (WHERE mv.banner_role_norm = 'JUNGLE')::int AS bans_jungle,
      SUM(mv.ban_count) FILTER (WHERE mv.banner_role_norm = 'MIDDLE')::int AS bans_middle,
      SUM(mv.ban_count) FILTER (WHERE mv.banner_role_norm = 'BOTTOM')::int AS bans_bottom,
      SUM(mv.ban_count) FILTER (WHERE mv.banner_role_norm = 'SUPPORT')::int AS bans_support
    FROM mv_champion_bans_by_banner mv
    WHERE ${mvWhere}
    ${roleCondMv}
    GROUP BY mv.banned_champion_id
    ORDER BY bans_total DESC, champion_id ASC
  `

  type SqlRow = {
    champion_id: number
    bans_total: number
    bans_blue: number
    bans_red: number
    bans_top: number
    bans_jungle: number
    bans_middle: number
    bans_bottom: number
    bans_support: number
  }

  const raw = await prisma.$queryRawUnsafe<SqlRow[]>(sql)
  const rows: ChampionBansTableRow[] = raw.map((r) => ({
    championId: Number(r.champion_id),
    bansTotal: Number(r.bans_total),
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
