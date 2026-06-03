import { queryRawUnsafe, isDatabaseConfigured } from '../db/query.js'
import { readBalanceRules, type BalanceLevelKey, type BalanceRulesConfig } from './BalanceRulesService.js'
import { matchVersionedAggFrom, normalizePatchMajorMinor, sqlAggUnionAllLiveAndArchives } from './statsAggArchive.js'
import {
  normalizeStatsRoleForBanner,
  normalizeStatsRoleForChampion,
  statsRoleSqlLiteral,
} from '../utils/statsFilters.js'

type BalanceStatus = 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
/** Rôles exposés à l’API / UI (MIDDLE, BOTTOM, …). */
const BALANCE_CLIENT_ROLES = new Set(['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'])

type BalanceRoleFilter = {
  client: string
  championSql: string
  bannerSql: string
}

type ChampionAgg = {
  games: number
  wins: number
  bans: number
}

type LevelSnapshotChampion = {
  key: string
  championId: number
  role: string
  games: number
  wins: number
  pickrate: number
  winrate: number
  banrate: number
  presence: number
}

type LevelSnapshot = {
  abr: number
  byChampionRole: Map<string, LevelSnapshotChampion>
}

type PatchSnapshot = {
  patch: string
  levels: Record<BalanceLevelKey, LevelSnapshot>
}

export type BalanceApiLevelRow = {
  games: number
  winrate: number
  pickrate: number
  banrate: number
  presence: number
  status: BalanceStatus
  previousStatus: BalanceStatus | null
  delta: string | null
}

export type BalanceApiRow = {
  championId: number
  role: string
  average: BalanceApiLevelRow
  skilled: BalanceApiLevelRow
  elite: BalanceApiLevelRow
  globalStatus: BalanceStatus
  previousGlobalStatus: BalanceStatus | null
  globalDelta: string | null
}

export type BalanceFrameworkResult = {
  rules: BalanceRulesConfig
  currentPatch: string
  previousPatch: string | null
  abrByLevel: {
    average: number
    skilled: number
    elite: number
  }
  rows: BalanceApiRow[]
}

export type GetBalanceFrameworkOptions = {
  version?: string | null
  role?: string | null
}

function patchLabel(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim()
  if (!v) return null
  const parts = v.split('.')
  if (parts.length < 2) return v
  return `${parts[0]}.${parts[1]}`
}

function comparePatch(a: string, b: string): number {
  const [aMajRaw, aMinRaw] = a.split('.')
  const [bMajRaw, bMinRaw] = b.split('.')
  const aMaj = Number(aMajRaw)
  const aMin = Number(aMinRaw)
  const bMaj = Number(bMajRaw)
  const bMin = Number(bMinRaw)
  if (aMaj !== bMaj) return aMaj - bMaj
  return aMin - bMin
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function findPreviousPatch(current: string, available: string[]): string | null {
  const sorted = [...available].sort((a, b) => comparePatch(b, a))
  const idx = sorted.findIndex((p) => p === current)
  if (idx < 0 || idx + 1 >= sorted.length) return null
  return sorted[idx + 1] ?? null
}

async function listAvailablePatches(): Promise<string[]> {
  const union = await sqlAggUnionAllLiveAndArchives('agg_champion_core_stats', 't')
  const rows = await queryRawUnsafe<Array<{ game_version: string }>>(`
    SELECT DISTINCT game_version
    FROM (
      SELECT t.game_version AS game_version
      FROM ${union}
    ) v
  `)
  return [
    ...new Set(
      rows
        .map((r) => patchLabel(r.game_version))
        .filter((v): v is string => Boolean(v))
    ),
  ]
}

function roleForClient(role: string): string {
  const v = String(role ?? '').toUpperCase()
  if (v === 'MID') return 'MIDDLE'
  if (v === 'ADC') return 'BOTTOM'
  return v
}

function balanceRoleKeyFromChampionColumn(role: string): string | null {
  const champ = normalizeStatsRoleForChampion(role)
  if (!champ) return null
  const client = roleForClient(champ)
  return BALANCE_CLIENT_ROLES.has(client) ? client : null
}

function balanceRoleKeyFromBannerColumn(role: string): string | null {
  const banner = normalizeStatsRoleForBanner(role)
  if (!banner) return null
  return BALANCE_CLIENT_ROLES.has(banner) ? banner : null
}

/** Filtre rôle : SQL champion (MID/ADC) + bans (MIDDLE/BOTTOM), clé client unifiée. */
function normalizeRoleFilter(role: string | null | undefined): BalanceRoleFilter | null {
  const raw = String(role ?? '').trim().toUpperCase()
  if (!raw) return null
  const championSql = normalizeStatsRoleForChampion(raw)
  const bannerSql = normalizeStatsRoleForBanner(raw)
  if (!championSql || !bannerSql) return null
  const client = roleForClient(championSql)
  if (!BALANCE_CLIENT_ROLES.has(client)) return null
  return { client, championSql, bannerSql }
}

function makeChampionRoleKey(championId: number, role: string): string {
  return `${championId}:${role}`
}

function parseChampionRoleKey(key: string): { championId: number; role: string } {
  const [cid, role] = key.split(':')
  return { championId: Number(cid), role: role ?? 'UNKNOWN' }
}

function initChampionAggMap(key: string, map: Map<string, ChampionAgg>): ChampionAgg {
  let row = map.get(key)
  if (!row) {
    row = { games: 0, wins: 0, bans: 0 }
    map.set(key, row)
  }
  return row
}

function evaluateLevelStatus(
  level: BalanceLevelKey,
  row: LevelSnapshotChampion | undefined,
  abr: number,
  rules: BalanceRulesConfig
): BalanceStatus {
  const levelRules = rules.levels[level]
  if (!row || row.games < levelRules.overpowered.minGames) return 'BALANCED'

  const opRules = levelRules.overpowered
  const wrThreshold =
    row.banrate >= abr * opRules.banrateMultiplier ? opRules.winrateLow : opRules.winrateHigh
  const opByWr = row.winrate >= wrThreshold
  const opByBanTwoPatch =
    level === 'elite' &&
    opRules.banrateTwoPatchAvgMin != null &&
    row.banrate >= opRules.banrateTwoPatchAvgMin

  if (opByWr || opByBanTwoPatch) return 'OVERPOWERED'

  if (level === 'elite') {
    const maxPresence = levelRules.underpowered.presenceMax ?? 7.5
    if (row.presence < maxPresence) return 'UNDERPOWERED'
    return 'BALANCED'
  }

  const maxWr = levelRules.underpowered.winrateMax ?? 49
  if (row.winrate < maxWr) return 'UNDERPOWERED'
  return 'BALANCED'
}

function deltaLabel(current: BalanceStatus, previous: BalanceStatus | null): string | null {
  if (previous == null || previous === current) return null
  return `${previous} -> ${current}`
}

async function buildPatchSnapshot(
  patch: string,
  roleFilter: BalanceRoleFilter | null,
  rules: BalanceRulesConfig
): Promise<PatchSnapshot> {
  type CoreRow = {
    champion_id: number
    rank_tier: string
    role: string
    count_game: number
    count_win: number
  }
  type BanRow = {
    banned_champion_id: number
    rank_tier: string
    banner_role_norm: string
    ban_count: number
  }
  const allTiers = new Set<string>()
  ;(['average', 'skilled', 'elite'] as const).forEach((k) => {
    for (const tier of rules.levels[k].tiers) allTiers.add(tier)
  })
  const tiers = [...allTiers]

  const coreFrom = await matchVersionedAggFrom('agg_champion_core_stats', patch, 'cc')
  const tiersSql = tiers.map((t) => `'${String(t).replace(/'/g, "''")}'`).join(', ')
  const roleSql = roleFilter
    ? `AND role = '${statsRoleSqlLiteral(roleFilter.championSql)}'`
    : ''
  const patchLike = `${normalizePatchMajorMinor(patch).replace(/'/g, "''")}%`
  const coreRowsEffective = await queryRawUnsafe<CoreRow[]>(`
      SELECT champion_id, rank_tier, role, count_game, count_win
      FROM ${coreFrom}
      WHERE game_version LIKE '${patchLike}'
        AND rank_tier IN (${tiersSql})
        ${roleSql}
    `)
  const bansFrom = await matchVersionedAggFrom('agg_champion_bans_by_banner', patch, 'bb')
  const banRoleSql = roleFilter
    ? `AND banner_role_norm = '${statsRoleSqlLiteral(roleFilter.bannerSql)}'`
    : ''
  const banRowsEffective = await queryRawUnsafe<BanRow[]>(`
      SELECT banned_champion_id, rank_tier, banner_role_norm, ban_count
      FROM ${bansFrom}
      WHERE game_version LIKE '${patchLike}'
        AND rank_tier IN (${tiersSql})
        ${banRoleSql}
    `)

  const byLevel: Record<BalanceLevelKey, Map<string, ChampionAgg>> = {
    average: new Map(),
    skilled: new Map(),
    elite: new Map(),
  }
  const participantsByLevel: Record<BalanceLevelKey, number> = {
    average: 0,
    skilled: 0,
    elite: 0,
  }
  const participantsByLevelByRole: Record<BalanceLevelKey, Map<string, number>> = {
    average: new Map(),
    skilled: new Map(),
    elite: new Map(),
  }
  for (const r of coreRowsEffective) {
    const rankTier = String(r.rank_tier).toUpperCase()
    const roleKey = balanceRoleKeyFromChampionColumn(String(r.role ?? ''))
    if (!roleKey) continue
    const cid = r.champion_id
    const key = makeChampionRoleKey(cid, roleKey)
    const games = r.count_game
    const wins = r.count_win
    ;(['average', 'skilled', 'elite'] as const).forEach((lvl) => {
      if (!rules.levels[lvl].tiers.includes(rankTier)) return
      participantsByLevel[lvl] += games
      participantsByLevelByRole[lvl].set(
        roleKey,
        (participantsByLevelByRole[lvl].get(roleKey) ?? 0) + games
      )
      const agg = initChampionAggMap(key, byLevel[lvl])
      agg.games += games
      agg.wins += wins
    })
  }

  for (const r of banRowsEffective) {
    const rankTier = String(r.rank_tier).toUpperCase()
    const roleKey = balanceRoleKeyFromBannerColumn(String(r.banner_role_norm ?? ''))
    if (!roleKey) continue
    const cid = r.banned_champion_id
    const key = makeChampionRoleKey(cid, roleKey)
    const bans = r.ban_count
    ;(['average', 'skilled', 'elite'] as const).forEach((lvl) => {
      if (!rules.levels[lvl].tiers.includes(rankTier)) return
      const agg = initChampionAggMap(key, byLevel[lvl])
      agg.bans += bans
    })
  }

  const levels = (['average', 'skilled', 'elite'] as const).reduce((acc, lvl) => {
    const participantTotal = participantsByLevel[lvl]
    const perMatchFactor = roleFilter ? 2 : 10
    const matchTotal = participantTotal > 0 ? participantTotal / perMatchFactor : 0

    const byChampionRole = new Map<string, LevelSnapshotChampion>()
    for (const [key, a] of byLevel[lvl].entries()) {
      const { championId, role: championRole } = parseChampionRoleKey(key)
      const roleParticipantTotal = roleFilter
        ? participantTotal
        : Number(participantsByLevelByRole[lvl].get((championRole || '').toUpperCase()) ?? 0)
      const pickrate = roleParticipantTotal > 0 ? (a.games / roleParticipantTotal) * 100 : 0
      const winrate = a.games > 0 ? (a.wins / a.games) * 100 : 0
      const banrate = matchTotal > 0 ? (a.bans / (2 * matchTotal)) * 100 : 0
      const presence = pickrate + banrate

      byChampionRole.set(key, {
        key,
        championId,
        role: championRole || roleFilter?.client || 'UNKNOWN',
        games: a.games,
        wins: a.wins,
        pickrate: round2(pickrate),
        winrate: round2(winrate),
        banrate: round2(banrate),
        presence: round2(presence),
      })
    }

    const rates = [...byChampionRole.values()]
      .filter((r) => r.games >= rules.levels[lvl].overpowered.minGames)
      .map((r) => r.banrate)
    const abr = rates.length > 0 ? rates.reduce((s, v) => s + v, 0) / rates.length : 0
    acc[lvl] = { abr: round2(abr), byChampionRole }
    return acc
  }, {} as Record<BalanceLevelKey, LevelSnapshot>)

  return { patch, levels }
}

/** Parties max (average / skilled / elite) pour comparer les rôles d’un même champion. */
export function balanceRowGamesScore(row: Pick<BalanceApiRow, 'average' | 'skilled' | 'elite'>): number {
  return Math.max(row.average.games, row.skilled.games, row.elite.games)
}

/** Filtre « tous les rôles » : une ligne par champion, rôle le plus joué (comme la tier list). */
export function collapseBalanceRowsToMainRole(rows: BalanceApiRow[]): BalanceApiRow[] {
  const byChampion = new Map<number, BalanceApiRow>()
  for (const row of rows) {
    const existing = byChampion.get(row.championId)
    if (!existing || balanceRowGamesScore(row) > balanceRowGamesScore(existing)) {
      byChampion.set(row.championId, row)
    }
  }
  return [...byChampion.values()]
}

function computeGlobalStatus(statuses: Record<BalanceLevelKey, BalanceStatus>): BalanceStatus {
  if (statuses.average === 'OVERPOWERED' || statuses.skilled === 'OVERPOWERED' || statuses.elite === 'OVERPOWERED') {
    return 'OVERPOWERED'
  }
  if (
    statuses.average === 'UNDERPOWERED' &&
    statuses.skilled === 'UNDERPOWERED' &&
    statuses.elite === 'UNDERPOWERED'
  ) {
    return 'UNDERPOWERED'
  }
  return 'BALANCED'
}

export async function getBalanceFramework(
  options: GetBalanceFrameworkOptions
): Promise<BalanceFrameworkResult | null> {
  if (!isDatabaseConfigured()) return null

  const rules = await readBalanceRules()
  const available = await listAvailablePatches()
  if (available.length === 0) {
    return {
      rules,
      currentPatch: '',
      previousPatch: null,
      abrByLevel: { average: 0, skilled: 0, elite: 0 },
      rows: [],
    }
  }

  const sorted = [...available].sort((a, b) => comparePatch(b, a))
  let currentPatch = patchLabel(options.version) ?? sorted[0] ?? null
  if (!currentPatch) {
    return {
      rules,
      currentPatch: '',
      previousPatch: null,
      abrByLevel: { average: 0, skilled: 0, elite: 0 },
      rows: [],
    }
  }

  const roleFilter = normalizeRoleFilter(options.role)

  const snapshotHasRows = (snap: PatchSnapshot): boolean =>
    (['average', 'skilled', 'elite'] as const).some((lvl) => snap.levels[lvl].byChampionRole.size > 0)

  let currentSnapshot = await buildPatchSnapshot(currentPatch, roleFilter, rules)
  if (!snapshotHasRows(currentSnapshot) && sorted.length > 0) {
    const fallbackPatch = sorted[0]!
    if (fallbackPatch !== currentPatch) {
      currentPatch = fallbackPatch
      currentSnapshot = await buildPatchSnapshot(currentPatch, roleFilter, rules)
    }
  }

  const previousPatch = findPreviousPatch(currentPatch, sorted)
  const beforePreviousPatch = previousPatch ? findPreviousPatch(previousPatch, sorted) : null

  const previousSnapshot = previousPatch
    ? await buildPatchSnapshot(previousPatch, roleFilter, rules)
    : null
  const beforePreviousSnapshot = beforePreviousPatch
    ? await buildPatchSnapshot(beforePreviousPatch, roleFilter, rules)
    : null

  const championRoleKeys = new Set<string>()
  ;(['average', 'skilled', 'elite'] as const).forEach((lvl) => {
    for (const key of currentSnapshot.levels[lvl].byChampionRole.keys()) championRoleKeys.add(key)
  })

  const rows: BalanceApiRow[] = [...championRoleKeys]
    .map((championRoleKey) => {
      const { championId, role: roleFromKey } = parseChampionRoleKey(championRoleKey)
      const statusByLevel = {} as Record<BalanceLevelKey, BalanceStatus>
      const prevStatusByLevel = {} as Record<BalanceLevelKey, BalanceStatus | null>

      const mkLevel = (lvl: BalanceLevelKey): BalanceApiLevelRow => {
        const currentRow = currentSnapshot.levels[lvl].byChampionRole.get(championRoleKey)
        const prevRow = previousSnapshot?.levels[lvl].byChampionRole.get(championRoleKey)

        const currentBanTwoPatch = (() => {
          if (lvl !== 'elite') return currentRow?.banrate
          const left = currentRow?.banrate
          const right = previousSnapshot?.levels.elite.byChampionRole.get(championRoleKey)?.banrate
          if (left == null) return 0
          if (right == null) return left
          return round2((left + right) / 2)
        })()

        const prevBanTwoPatch = (() => {
          if (lvl !== 'elite') return prevRow?.banrate
          const left = prevRow?.banrate
          const right = beforePreviousSnapshot?.levels.elite.byChampionRole.get(championRoleKey)?.banrate
          if (left == null) return 0
          if (right == null) return left
          return round2((left + right) / 2)
        })()

        const currentEvalRow =
          currentRow && lvl === 'elite' && currentBanTwoPatch != null
            ? { ...currentRow, banrate: currentBanTwoPatch }
            : currentRow
        const prevEvalRow =
          prevRow && lvl === 'elite' && prevBanTwoPatch != null
            ? { ...prevRow, banrate: prevBanTwoPatch }
            : prevRow

        const status = evaluateLevelStatus(
          lvl,
          currentEvalRow,
          currentSnapshot.levels[lvl].abr,
          rules
        )
        const previousStatus = previousSnapshot
          ? evaluateLevelStatus(lvl, prevEvalRow, previousSnapshot.levels[lvl].abr, rules)
          : null

        statusByLevel[lvl] = status
        prevStatusByLevel[lvl] = previousStatus

        return {
          games: currentRow?.games ?? 0,
          winrate: currentRow?.winrate ?? 0,
          pickrate: currentRow?.pickrate ?? 0,
          banrate: currentBanTwoPatch ?? currentRow?.banrate ?? 0,
          presence: currentRow?.presence ?? 0,
          status,
          previousStatus,
          delta: deltaLabel(status, previousStatus),
        }
      }

      const average = mkLevel('average')
      const skilled = mkLevel('skilled')
      const elite = mkLevel('elite')

      const globalStatus = computeGlobalStatus(statusByLevel)
      const previousGlobalStatus = previousSnapshot
        ? computeGlobalStatus({
            average: prevStatusByLevel.average ?? 'BALANCED',
            skilled: prevStatusByLevel.skilled ?? 'BALANCED',
            elite: prevStatusByLevel.elite ?? 'BALANCED',
          })
        : null

      return {
        championId,
        role: roleForClient(roleFromKey || roleFilter?.client || 'UNKNOWN'),
        average,
        skilled,
        elite,
        globalStatus,
        previousGlobalStatus,
        globalDelta: deltaLabel(globalStatus, previousGlobalStatus),
      }
    })
    .sort((a, b) => {
      const order = (s: BalanceStatus): number =>
        s === 'OVERPOWERED' ? 0 : s === 'UNDERPOWERED' ? 1 : 2
      const o = order(a.globalStatus) - order(b.globalStatus)
      if (o !== 0) return o
      return b.average.games + b.skilled.games + b.elite.games - (a.average.games + a.skilled.games + a.elite.games)
    })

  return {
    rules,
    currentPatch,
    previousPatch,
    abrByLevel: {
      average: currentSnapshot.levels.average.abr,
      skilled: currentSnapshot.levels.skilled.abr,
      elite: currentSnapshot.levels.elite.abr,
    },
    rows,
  }
}

export const __testOnly = {
  comparePatch,
  patchLabel,
  deltaLabel,
  computeGlobalStatus,
  balanceRowGamesScore,
  collapseBalanceRowsToMainRole,
  normalizeRoleFilter,
  balanceRoleKeyFromChampionColumn,
  balanceRoleKeyFromBannerColumn,
}
