/**
 * Table des bans par champion, avec attribution au joueur (slot d’équipe) et au rôle du banneur.
 * Données lues depuis la table d'agrégat `agg_champion_bans_by_banner`.
 * Filtres patch / ligue alignés sur ChampionGlobalTableService.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { buildRawMatchCond } from './ChampionGlobalTableService.js'
import { matchVersionedAggFrom } from './statsAggArchive.js'

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

type OtpMode = 'oui' | 'non' | 'solo'

function otpModeFromQuery(value: string | null | undefined): OtpMode {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'oui' || raw === 'yes' || raw === 'true' || raw === '1' || raw === 'all') return 'oui'
  if (raw === 'solo' || raw === 'niche') return 'solo'
  return 'non'
}

function keepByOtpPickratePercent(pickratePercent: number, mode: OtpMode, threshold: number): boolean {
  if (mode === 'oui') return true
  if (mode === 'solo') return pickratePercent < threshold
  return pickratePercent >= threshold
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
  role?: string | null,
  otp?: string | null
): Promise<{ matchCount: number; rows: ChampionBansTableRow[] } | null> {
  if (!isDatabaseConfigured()) return null
  const otpMode = otpModeFromQuery(otp)
  const otpThreshold = Number(process.env.STATS_OTP_PICKRATE_THRESHOLD ?? '1')
  const matchCond = buildRawMatchCond(version, rankTier)
  const moFrom = await matchVersionedAggFrom('agg_match_outcome_stats', version, 'mo')
  const mvFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', version, 'mv')
  const csFrom = await matchVersionedAggFrom('agg_champion_side_stats', version, 'cs')
  const roleFilter = normalizeRoleFilter(role)
  /**
   * Filtre rôle "joué" pour l'onglet Bans:
   * - On conserve uniquement les champions qui ont des games sur ce rôle
   *   dans le même périmètre version/rank.
   * - On NE filtre pas les bans par rôle du banneur ici.
   */
  const rolePlayedCond =
    roleFilter != null
      ? `AND EXISTS (
          SELECT 1
          FROM ${csFrom}
          WHERE cs.champion_id = mv.banned_champion_id
            AND ${buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')}
            AND cs.role_norm = '${roleFilter.replace(/'/g, "''")}'
            AND cs.count_game > 0
        )`
      : ''

  const matchCountRows = await prisma.$queryRawUnsafe<Array<{ mc: bigint }>>(
    `SELECT COALESCE(SUM(mo.count_match), 0)::bigint AS mc
     FROM ${moFrom}
     WHERE ${matchCond.replace(/\bm\./g, 'mo.')}`
  )
  const matchCount = Math.max(0, Number(matchCountRows[0]?.mc ?? 0))
  if (matchCount === 0) {
    return { matchCount: 0, rows: [] }
  }

  /** Même prédicat que sur `matchs`, appliqué à l’alias `mv` (table `agg_champion_bans_by_banner`). */
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
    FROM ${mvFrom}
    WHERE ${mvWhere}
    ${rolePlayedCond}
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

  if (otpMode !== 'oui' && rows.length > 0) {
    const sideWhere = buildRawMatchCond(version, rankTier).replace(/\bm\./g, 'cs.')
    const roleSql =
      roleFilter != null ? ` AND cs.role_norm = '${roleFilter.replace(/'/g, "''")}'` : ''
    const pickRows = await prisma.$queryRawUnsafe<Array<{ champion_id: number; games: bigint }>>(`
      SELECT
        cs.champion_id::int AS champion_id,
        SUM(cs.count_game)::bigint AS games
      FROM ${csFrom}
      WHERE ${sideWhere}
      ${roleSql}
      GROUP BY cs.champion_id
    `)
    const gamesByChampion = new Map<number, number>()
    let totalGames = 0
    for (const r of pickRows) {
      const g = Number(r.games ?? 0)
      gamesByChampion.set(Number(r.champion_id), g)
      totalGames += g
    }
    const otpFiltered = rows.filter((row) => {
      if (totalGames <= 0) return true
      const g = gamesByChampion.get(row.championId) ?? 0
      const pickratePct = (g / totalGames) * 100
      return keepByOtpPickratePercent(pickratePct, otpMode, otpThreshold)
    })
    return { matchCount, rows: otpFiltered.length > 0 ? otpFiltered : rows }
  }

  return { matchCount, rows }
}
