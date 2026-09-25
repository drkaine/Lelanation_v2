/** API payload shapes of the statistics index page (GET /api/stats/*). */
import type {
  ChampionGlobalTableRow,
  OverviewSidesProgRow,
} from '~/utils/statistics/statisticsTableFormat'

export type OverviewData = {
  totalMatches: number
  lastUpdate: string | null
  message?: string
  topWinrateChampions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  topPickrateChampions?: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  topBanrateChampions?: Array<{
    championId: number
    banCount: number
    banrate: number
  }>
  matchesByDivision: Array<{ rankTier: string; matchCount: number }>
  matchesByVersion?: Array<{ version: string; matchCount: number }>
  playerCount: number
  surrenderBySide?: {
    blue: { total: number; earlySurrenderCount: number; surrenderCount: number }
    red: { total: number; earlySurrenderCount: number; surrenderCount: number }
  }
}

export type InfosMatrixData = {
  divisions: string[]
  rows: Array<{ version: string; all: number; byDivision: Record<string, number> }>
}

export type InfosMetaData = {
  totalMatches: number
  totalPlayers: number
  playersWithIngestMatches: number
}

export type BalanceStatus = 'OVERPOWERED' | 'UNDERPOWERED' | 'BALANCED'
export type BalanceLevelKey = 'average' | 'skilled' | 'elite'

/** Mirrors backend BalanceRulesConfig (services/BalanceRulesService.ts). */
export type BalanceRulesConfig = {
  levels: Record<
    BalanceLevelKey,
    {
      tiers: string[]
      overpowered: {
        winrateHigh: number
        winrateLow: number
        banrateMultiplier: number
        minGames: number
        banrateTwoPatchAvgMin?: number
      }
      underpowered: { winrateMax?: number; presenceMax?: number }
    }
  >
}

/** Mirrors backend BalanceApiLevelRow (services/StatsBalanceService.ts). */
export type BalanceLevelRow = {
  games: number
  winrate: number
  pickrate: number
  banrate: number
  presence: number
  status: BalanceStatus
  previousStatus: BalanceStatus | null
  delta: string | null
}

export type BalanceFrameworkRow = {
  championId: number
  role: string
  average: BalanceLevelRow
  skilled: BalanceLevelRow
  elite: BalanceLevelRow
  globalStatus: BalanceStatus
  previousGlobalStatus: BalanceStatus | null
  globalDelta: string | null
}

export type BalanceFrameworkData = {
  rules: BalanceRulesConfig | null
  currentPatch: string
  previousPatch: string | null
  abrByLevel: Record<BalanceLevelKey, number>
  rows: BalanceFrameworkRow[]
}

export type OverviewDetailData = {
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    shards?: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  shards?: Array<{
    shardId: number
    slot: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  items: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  itemsStarters?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsCores?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsFinals?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsBoots?: Array<{
    itemId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemSets: Array<{
    items: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemStarterSets?: Array<{
    items: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsByOrder: Record<
    string,
    Array<{ itemId: number; games: number; wins: number; winrate: number }>
  >
  summonerSpells: Array<{
    spellId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
    countSlot0?: number
    countSlot1?: number
    pctSlotD?: number
    pctSlotF?: number
    highEloGames?: number
    highEloWinrate?: number
    highEloRank?: number
  }>
  summonerSpellSets: Array<{
    spellIdD: number
    spellIdF: number
    games: number
    wins: number
    pickrate: number
    winrate: number
    highEloGames?: number
    highEloWinrate?: number
    highEloRank?: number
  }>
}

export type OverviewDurationWinrateData = {
  buckets: Array<{ durationMin: number; matchCount: number; wins: number; winrate: number }>
}

export type OverviewAbandonsData = {
  totalMatches: number
  remakeCount: number
  remakeRate: number
  surrenderCount: number
  surrenderRate: number
  earlySurrenderCount: number
  earlySurrenderRate: number
}

export type SurrenderMatrixData = {
  version: string | null
  baselineVersion: string | null
  rows: Array<{
    rankTier: string
    team: 'ALL' | 100 | 200
    matchCount: number
    surrenderCount: number
    earlySurrenderCount: number
    surrenderRate: number
    earlySurrenderRate: number
    surrenderDelta: number | null
    earlySurrenderDelta: number | null
  }>
}

export type OverviewProgressionData = {
  oldestVersion: string | null
  gainers: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }>
  losers: Array<{ championId: number; wrOldest: number; wrSince: number; delta: number }>
}

export type ProgressionFullData = {
  oldestVersion: string | null
  champions: Array<{
    championId: number
    wrOldest: number
    wrSince: number
    deltaWr: number
    pickrateOldest: number
    pickrateSince: number
    deltaPick: number
    banrateOldest: number
    banrateSince: number
    deltaBan: number
  }>
}

export type DurationWinrateTooltip = {
  durationLabel: string
  winrate: number
  matchCount: number
  index: number
}

export type DurationChartTooltip = {
  durationLabel: string
  winrate: number
  matchCount: number
  x: number
  y: number
}

export type OverviewTeamsData = {
  matchCount: number
  objectiveFirstWinrateGlobal?: {
    firstBlood: number | null
    baron: number | null
    dragon: number | null
    tower: number | null
    inhibitor: number | null
    riftHerald: number | null
    horde: number | null
  }
  bans: {
    byWin: Array<{ championId: number; count: number; banRatePercent: string }>
    byLoss: Array<{ championId: number; count: number; banRatePercent: string }>
    top20Total: Array<{ championId: number; count: number; banRatePercent: string }>
  }
  objectives: {
    firstBlood: { firstByWin: number; firstByLoss: number }
    baron: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    dragon: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    elder?: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    tower: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    inhibitor: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    riftHerald: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    horde: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
  }
  drakes?: {
    types: {
      elder: {
        byWin: number
        byLoss: number
        securedWinrateGlobal?: number | null
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      earth: {
        byWin: number
        byLoss: number
        securedWinrateGlobal?: number | null
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      water: {
        byWin: number
        byLoss: number
        securedWinrateGlobal?: number | null
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      wind: {
        byWin: number
        byLoss: number
        securedWinrateGlobal?: number | null
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      fire: {
        byWin: number
        byLoss: number
        securedWinrateGlobal?: number | null
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      hextec: {
        byWin: number
        byLoss: number
        securedWinrateGlobal?: number | null
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
      chem: {
        byWin: number
        byLoss: number
        securedWinrateGlobal?: number | null
        distributionByWin: Record<string, number>
        distributionByLoss: Record<string, number>
      }
    }
    souls: {
      earth: { byWin: number; byLoss: number }
      water: { byWin: number; byLoss: number }
      wind: { byWin: number; byLoss: number }
      fire: { byWin: number; byLoss: number }
      hextec: { byWin: number; byLoss: number }
      chem: { byWin: number; byLoss: number }
    }
  }
}

export type OverviewSidesData = {
  matchCount: number
  objectiveFirstWinrateBySide?: {
    firstBlood: { blue: number | null; red: number | null }
    baron: { blue: number | null; red: number | null }
    dragon: { blue: number | null; red: number | null }
    tower: { blue: number | null; red: number | null }
    inhibitor: { blue: number | null; red: number | null }
    riftHerald: { blue: number | null; red: number | null }
    horde: { blue: number | null; red: number | null }
  }
  sideWinrate: {
    blue: { matches: number; wins: number; winrate: number }
    red: { matches: number; wins: number; winrate: number }
  }
  championWinrateBySide: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  championPickBySide?: {
    blue: Array<{ championId: number; games: number; wins: number; winrate: number }>
    red: Array<{ championId: number; games: number; wins: number; winrate: number }>
  }
  objectivesBySide: {
    blue: Record<string, number>
    red: Record<string, number>
  }
  objectivesBySideTable?: {
    firstBlood: {
      firstByBlue: number
      firstByRed: number
      distributionByBlue?: Record<string, number>
      distributionByRed?: Record<string, number>
    }
    [key: string]:
      | {
          firstByBlue?: number
          firstByRed?: number
          killsByBlue?: number
          killsByRed?: number
          distributionByBlue?: Record<string, number>
          distributionByRed?: Record<string, number>
        }
      | undefined
  }
  bansBySide: {
    blue: Array<{ championId: number; count: number }>
    red: Array<{ championId: number; count: number }>
  }
  drakesBySide?: {
    types: Record<
      string,
      {
        byBlue: number
        byRed: number
        winrateBlue?: number | null
        winrateRed?: number | null
        distributionByBlue?: Record<string, number>
        distributionByRed?: Record<string, number>
      }
    >
    souls: Record<
      string,
      { byBlue: number; byRed: number; winrateBlue?: number | null; winrateRed?: number | null }
    >
  }
  surrenderBySide?: {
    blue: {
      total: number
      earlySurrenderCount: number
      surrenderCount: number
    }
    red: {
      total: number
      earlySurrenderCount: number
      surrenderCount: number
    }
  }
}

export type OverviewSidesProgressionData = {
  oldestVersion: string | null
  blue: OverviewSidesProgRow[]
  red: OverviewSidesProgRow[]
}

export type ChampionsData = {
  totalGames: number
  totalMatches?: number
  champions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
    banrate?: number
  }>
  message?: string
}

export type ChampionGlobalTableData = {
  matchCount: number
  rows: ChampionGlobalTableRow[]
  transformBreakdown?: ChampionGlobalTableRow[]
  error?: string
  message?: string
}

export type TeamObjectiveKey = keyof OverviewTeamsData['objectives']
export type DrakeTypeKey = keyof NonNullable<OverviewTeamsData['drakes']>['types']
export type DrakeSoulKey = keyof NonNullable<OverviewTeamsData['drakes']>['souls']

export type DrakeTypeRow = {
  key: DrakeTypeKey
  label: string
  byWin: number
  byLoss: number
  securedWinrateGlobal: number | null
  distributionByWin: Record<string, number>
  distributionByLoss: Record<string, number>
}

export type DrakeSoulRow = { key: DrakeSoulKey; label: string; byWin: number; byLoss: number }

/** Runes panel payload (overview-detail runes part, also built by the champion page). */
export type RunesDetailPayload = {
  totalParticipants: number
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    shards?: number[]
    /** Raw DB value when `shards` was not parsed server-side. */
    shardList?: string
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  shards?: Array<{
    shardId: number
    slot: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
}

/** Summoner spells part of overview-detail (also built by the champion page). */
export type SpellsDetailPayload = Pick<OverviewDetailData, 'summonerSpells' | 'summonerSpellSets'>
