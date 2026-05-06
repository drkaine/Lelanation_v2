import { isDatabaseConfigured, prisma } from '../db.js'
import { toQueryStringArrayParam } from '../utils/statsFilters.js'
import { normalizePatchMajorMinor } from './statsAggArchive.js'

export type ChampionObjectiveSummary = {
  championId: number
  games: number
  wins: number
  winrate: number
  metrics: Array<{
    key: string
    label: string
    total: number
    perGame: number
  }>
}

type RawObjectiveAgg = {
  games: bigint
  wins: bigint
  baron_kills: bigint
  dragon_kills: bigint
  first_blood_involved: bigint
  first_tower_involved: bigint
  earth_drake_total: bigint
  water_drake_total: bigint
  wind_drake_total: bigint
  fire_drake_total: bigint
  hextec_drake_total: bigint
  chem_drake_total: bigint
  earth_soul_total: bigint
  water_soul_total: bigint
  wind_soul_total: bigint
  fire_soul_total: bigint
  hextec_soul_total: bigint
  chem_soul_total: bigint
}

const ARCHIVE_CORE_TABLE = 'archive_agg_champion_core_stats'
const ARCHIVE_PART_TABLE = 'archive_agg_champion_participant_stats'
const columnCache = new Map<string, Set<string>>()

async function getTableColumns(tableName: string): Promise<Set<string>> {
  const cached = columnCache.get(tableName)
  if (cached) return cached
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}'
    `
  )
  const cols = new Set(rows.map(r => String(r.column_name ?? '').trim()).filter(Boolean))
  columnCache.set(tableName, cols)
  return cols
}

function pickColumn(cols: Set<string>, candidates: string[], fallbackSql = '0'): string {
  for (const c of candidates) {
    if (cols.has(c)) return `ap.${c}`
  }
  return fallbackSql
}

function jsonBucketTotalExpr(cols: Set<string>, winCol: string, lossCol: string): string {
  if (!cols.has(winCol) && !cols.has(lossCol)) return '0'
  const sumJson = (col: string): string =>
    cols.has(col)
      ? `(SELECT COALESCE(SUM((e.value)::bigint),0) FROM jsonb_each_text(COALESCE(ap.${col}, '{}'::jsonb)) e)`
      : '0'
  return `(${sumJson(winCol)} + ${sumJson(lossCol)})`
}

function buildWhere(
  championId: number,
  version: string | null,
  rankTier: string | string[] | null | undefined,
  role: string | null
): string {
  const parts: string[] = [`ac.champion_id = ${championId}`]
  const ranks = toQueryStringArrayParam(rankTier).map(r => r.toUpperCase())
  if (ranks.length === 1) parts.push(`ac.rank_tier = '${ranks[0]!.replace(/'/g, "''")}'`)
  else if (ranks.length > 1) {
    parts.push(`ac.rank_tier IN (${ranks.map(r => `'${r.replace(/'/g, "''")}'`).join(',')})`)
  }
  if (version) {
    parts.push(`ac.game_version LIKE '${normalizePatchMajorMinor(version).replace(/'/g, "''")}%'`)
  }
  if (role) {
    parts.push(`ac.role = '${role.toUpperCase().replace(/'/g, "''")}'`)
  }
  return parts.join(' AND ')
}

export async function getChampionObjectivesSummary(options: {
  championId: number
  version?: string | null
  rankTier?: string | string[] | null
  role?: string | null
}): Promise<ChampionObjectiveSummary | null> {
  if (!isDatabaseConfigured()) return null
  const championId = options.championId
  const version = options.version ?? null
  const role = options.role ?? null
  const where = buildWhere(championId, version, options.rankTier, role)
  const cols = await getTableColumns(ARCHIVE_PART_TABLE)
  const baronExpr = pickColumn(cols, ['sum_baron_kills'])
  const dragonExpr = pickColumn(cols, ['sum_dragon_kills'])
  const firstBloodExpr = `(${pickColumn(cols, ['count_first_blood_kill_true'])} + ${pickColumn(cols, ['count_first_blood_assist_true'])})`
  const firstTowerExpr = `(${pickColumn(cols, ['count_first_tower_kill_true'])} + ${pickColumn(cols, ['count_first_tower_assist_true'])})`

  const earthDrakeExpr = jsonBucketTotalExpr(cols, 'earth_drake_win_team', 'earth_drake_loose_team')
  const waterDrakeExpr = jsonBucketTotalExpr(cols, 'water_drake_win_team', 'water_drake_loose_team')
  const windDrakeExpr = jsonBucketTotalExpr(cols, 'wind_drake_win_team', 'wind_drake_loose_team')
  const fireDrakeExpr = jsonBucketTotalExpr(cols, 'fire_drake_win_team', 'fire_drake_loose_team')
  const hextecDrakeExpr = jsonBucketTotalExpr(cols, 'hextec_drake_win_team', 'hextec_drake_loose_team')
  const chemDrakeExpr = jsonBucketTotalExpr(cols, 'chem_drake_win_team', 'chem_drake_loose_team')
  const earthSoulExpr = jsonBucketTotalExpr(cols, 'earth_soul_win_team', 'earth_soul_loose_team')
  const waterSoulExpr = jsonBucketTotalExpr(cols, 'water_soul_win_team', 'water_soul_loose_team')
  const windSoulExpr = jsonBucketTotalExpr(cols, 'wind_soul_win_team', 'wind_soul_loose_team')
  const fireSoulExpr = jsonBucketTotalExpr(cols, 'fire_soul_win_team', 'fire_soul_loose_team')
  const hextecSoulExpr = jsonBucketTotalExpr(cols, 'hextec_soul_win_team', 'hextec_soul_loose_team')
  const chemSoulExpr = jsonBucketTotalExpr(cols, 'chem_soul_win_team', 'chem_soul_loose_team')
  const rows = await prisma.$queryRawUnsafe<RawObjectiveAgg[]>(`
    SELECT
      COALESCE(SUM(ac.count_game), 0)::bigint AS games,
      COALESCE(SUM(ac.count_win), 0)::bigint AS wins,
      COALESCE(SUM(${baronExpr}), 0)::bigint AS baron_kills,
      COALESCE(SUM(${dragonExpr}), 0)::bigint AS dragon_kills,
      COALESCE(SUM(${firstBloodExpr}), 0)::bigint AS first_blood_involved,
      COALESCE(SUM(${firstTowerExpr}), 0)::bigint AS first_tower_involved,
      COALESCE(SUM(${earthDrakeExpr}), 0)::bigint AS earth_drake_total,
      COALESCE(SUM(${waterDrakeExpr}), 0)::bigint AS water_drake_total,
      COALESCE(SUM(${windDrakeExpr}), 0)::bigint AS wind_drake_total,
      COALESCE(SUM(${fireDrakeExpr}), 0)::bigint AS fire_drake_total,
      COALESCE(SUM(${hextecDrakeExpr}), 0)::bigint AS hextec_drake_total,
      COALESCE(SUM(${chemDrakeExpr}), 0)::bigint AS chem_drake_total,
      COALESCE(SUM(${earthSoulExpr}), 0)::bigint AS earth_soul_total,
      COALESCE(SUM(${waterSoulExpr}), 0)::bigint AS water_soul_total,
      COALESCE(SUM(${windSoulExpr}), 0)::bigint AS wind_soul_total,
      COALESCE(SUM(${fireSoulExpr}), 0)::bigint AS fire_soul_total,
      COALESCE(SUM(${hextecSoulExpr}), 0)::bigint AS hextec_soul_total,
      COALESCE(SUM(${chemSoulExpr}), 0)::bigint AS chem_soul_total
    FROM ${ARCHIVE_PART_TABLE} ap
    INNER JOIN ${ARCHIVE_CORE_TABLE} ac ON ac.id = ap.champion_stat_id
    WHERE ${where}
  `)
  const row = rows[0]
  const games = Number(row?.games ?? 0)
  const wins = Number(row?.wins ?? 0)
  if (games <= 0) {
    return { championId, games: 0, wins: 0, winrate: 0, metrics: [] }
  }
  const metrics = [
    { key: 'baronKills', label: 'Baron kills', total: Number(row?.baron_kills ?? 0) },
    { key: 'dragonKills', label: 'Dragon kills', total: Number(row?.dragon_kills ?? 0) },
    { key: 'earthDrake', label: 'Earth drake (timeline)', total: Number(row?.earth_drake_total ?? 0) },
    { key: 'waterDrake', label: 'Water drake (timeline)', total: Number(row?.water_drake_total ?? 0) },
    { key: 'windDrake', label: 'Wind drake (timeline)', total: Number(row?.wind_drake_total ?? 0) },
    { key: 'fireDrake', label: 'Fire drake (timeline)', total: Number(row?.fire_drake_total ?? 0) },
    { key: 'hextecDrake', label: 'Hextec drake (timeline)', total: Number(row?.hextec_drake_total ?? 0) },
    { key: 'chemDrake', label: 'Chem drake (timeline)', total: Number(row?.chem_drake_total ?? 0) },
    { key: 'earthSoul', label: 'Earth soul (timeline)', total: Number(row?.earth_soul_total ?? 0) },
    { key: 'waterSoul', label: 'Water soul (timeline)', total: Number(row?.water_soul_total ?? 0) },
    { key: 'windSoul', label: 'Wind soul (timeline)', total: Number(row?.wind_soul_total ?? 0) },
    { key: 'fireSoul', label: 'Fire soul (timeline)', total: Number(row?.fire_soul_total ?? 0) },
    { key: 'hextecSoul', label: 'Hextec soul (timeline)', total: Number(row?.hextec_soul_total ?? 0) },
    { key: 'chemSoul', label: 'Chem soul (timeline)', total: Number(row?.chem_soul_total ?? 0) },
    {
      key: 'firstBloodInvolved',
      label: 'First blood (kill+assist)',
      total: Number(row?.first_blood_involved ?? 0),
    },
    {
      key: 'firstTowerInvolved',
      label: 'First tower (kill+assist)',
      total: Number(row?.first_tower_involved ?? 0),
    },
  ].map(m => ({
    ...m,
    perGame: games > 0 ? Number((m.total / games).toFixed(3)) : 0,
  }))
  return {
    championId,
    games,
    wins,
    winrate: Number(((100 * wins) / games).toFixed(2)),
    metrics,
  }
}
