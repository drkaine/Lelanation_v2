import { prisma, isDatabaseConfigured } from '../db.js'
import { readBalanceRules, type BalanceLevelKey, type BalanceRulesConfig } from './BalanceRulesService.js'

type BalanceStatus = 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
const BALANCE_ALLOWED_ROLES = new Set(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'])

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
  const rows = await prisma.mvChampionCoreStat.findMany({
    select: { gameVersion: true },
    distinct: ['gameVersion'],
  })
  return [
    ...new Set(
      rows
        .map((r) => patchLabel(r.gameVersion))
        .filter((v): v is string => Boolean(v))
    ),
  ]
}

function normalizeRoleFilter(role: string | null | undefined): string | null {
  const v = String(role ?? '').trim().toUpperCase()
  if (!v) return null
  if (v === 'MIDDLE') return 'MID'
  if (v === 'BOTTOM') return 'ADC'
  if (!BALANCE_ALLOWED_ROLES.has(v)) return null
  return v
}

function roleForClient(role: string): string {
  const v = String(role ?? '').toUpperCase()
  if (v === 'MID') return 'MIDDLE'
  if (v === 'ADC') return 'BOTTOM'
  return v
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
  role: string | null,
  rules: BalanceRulesConfig
): Promise<PatchSnapshot> {
  const allTiers = new Set<string>()
  ;(['average', 'skilled', 'elite'] as const).forEach((k) => {
    for (const tier of rules.levels[k].tiers) allTiers.add(tier)
  })
  const tiers = [...allTiers]

  const coreRows = await prisma.mvChampionCoreStat.findMany({
    where: {
      gameVersion: { startsWith: patch },
      rankTier: { in: tiers },
      ...(role ? { role } : {}),
    },
    select: {
      championId: true,
      rankTier: true,
      role: true,
      countGame: true,
      countWin: true,
      countBan: true,
    },
  })

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
  for (const r of coreRows) {
    const rankTier = String(r.rankTier).toUpperCase()
    const roleNorm = String(r.role ?? '').toUpperCase()
    if (!BALANCE_ALLOWED_ROLES.has(roleNorm)) continue
    const cid = r.championId
    const key = makeChampionRoleKey(cid, roleNorm || 'UNKNOWN')
    const games = r.countGame
    const wins = r.countWin
    const bans = r.countBan

    ;(['average', 'skilled', 'elite'] as const).forEach((lvl) => {
      if (!rules.levels[lvl].tiers.includes(rankTier)) return
      participantsByLevel[lvl] += games
      const agg = initChampionAggMap(key, byLevel[lvl])
      agg.games += games
      agg.wins += wins
      agg.bans += bans
    })
  }

  const levels = (['average', 'skilled', 'elite'] as const).reduce((acc, lvl) => {
    const participantTotal = participantsByLevel[lvl]
    const perMatchFactor = role ? 2 : 10
    const matchTotal = participantTotal > 0 ? participantTotal / perMatchFactor : 0

    const byChampionRole = new Map<string, LevelSnapshotChampion>()
    for (const [key, a] of byLevel[lvl].entries()) {
      const { championId, role: championRole } = parseChampionRoleKey(key)
      const pickrate = participantTotal > 0 ? (a.games / participantTotal) * 100 : 0
      const winrate = a.games > 0 ? (a.wins / a.games) * 100 : 0
      const banrate = matchTotal > 0 ? (a.bans / (2 * matchTotal)) * 100 : 0
      const presence = pickrate + banrate

      byChampionRole.set(key, {
        key,
        championId,
        role: championRole || role || 'UNKNOWN',
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
  const selected = patchLabel(options.version) ?? sorted[0] ?? null
  if (!selected) {
    return {
      rules,
      currentPatch: '',
      previousPatch: null,
      abrByLevel: { average: 0, skilled: 0, elite: 0 },
      rows: [],
    }
  }

  const currentPatch = selected
  const previousPatch = findPreviousPatch(currentPatch, sorted)
  const beforePreviousPatch = previousPatch ? findPreviousPatch(previousPatch, sorted) : null

  const role = normalizeRoleFilter(options.role)
  const [currentSnapshot, previousSnapshot] = await Promise.all([
    buildPatchSnapshot(currentPatch, role, rules),
    previousPatch ? buildPatchSnapshot(previousPatch, role, rules) : Promise.resolve(null),
  ])
  const beforePreviousSnapshot = beforePreviousPatch
    ? await buildPatchSnapshot(beforePreviousPatch, role, rules)
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
        role: roleForClient(roleFromKey || role || 'UNKNOWN'),
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
}
