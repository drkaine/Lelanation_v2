import type {
  MatchupDifficultyBand,
  MatchupEntry,
  MatchupOutcomeKind,
} from '@lelanation/shared-types'
import {
  DIFFICULTY_BANDS,
  formatBuildVariantsCell,
  formatMatchupDifficulty,
  formatMatchupOutcome,
  matchupDifficultySortValue,
  OUTCOME_KINDS,
} from '~/utils/matchupEntryUtils'
import type { Build } from '~/types/build'

export type MatchupEntriesSortKey = 'rank' | 'difficulty'
export type MatchupEntriesSortDir = 'asc' | 'desc'

export type MatchupEntriesFilters = {
  rankMin: string
  rankMax: string
  champion: string
  difficultyMin: string
  difficultyMax: string
  difficultyBand: '' | MatchupDifficultyBand
  outcome: '' | MatchupOutcomeKind
  build: string
  comments: string
}

export type RankedMatchupEntry = {
  entry: MatchupEntry
  rank: number
}

export function createEmptyMatchupEntriesFilters(): MatchupEntriesFilters {
  return {
    rankMin: '',
    rankMax: '',
    champion: '',
    difficultyMin: '',
    difficultyMax: '',
    difficultyBand: '',
    outcome: '',
    build: '',
    comments: '',
  }
}

export function countActiveMatchupEntriesFilters(filters: MatchupEntriesFilters): number {
  let count = 0
  if (filters.rankMin.trim()) count++
  if (filters.rankMax.trim()) count++
  if (filters.champion.trim()) count++
  if (filters.difficultyMin.trim()) count++
  if (filters.difficultyMax.trim()) count++
  if (filters.difficultyBand) count++
  if (filters.outcome) count++
  if (filters.build.trim()) count++
  if (filters.comments.trim()) count++
  return count
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function entryMatchesFilters(
  row: RankedMatchupEntry,
  filters: MatchupEntriesFilters,
  build: Build | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): boolean {
  const { entry, rank } = row

  const rankMin = parseOptionalInt(filters.rankMin)
  if (rankMin !== null && rank < rankMin) return false
  const rankMax = parseOptionalInt(filters.rankMax)
  if (rankMax !== null && rank > rankMax) return false

  const championQ = filters.champion.trim().toLowerCase()
  if (championQ && !entry.opponent.name.toLowerCase().includes(championQ)) return false

  const diffValue = matchupDifficultySortValue(entry)
  const diffMin = parseOptionalInt(filters.difficultyMin)
  if (diffMin !== null && (diffValue === null || diffValue < diffMin)) return false
  const diffMax = parseOptionalInt(filters.difficultyMax)
  if (diffMax !== null && (diffValue === null || diffValue > diffMax)) return false
  if (filters.difficultyBand && entry.difficultyBand !== filters.difficultyBand) return false

  if (filters.outcome && entry.outcomeKind !== filters.outcome) return false

  const buildQ = filters.build.trim().toLowerCase()
  if (buildQ) {
    const buildText = formatBuildVariantsCell(entry, build, t).toLowerCase()
    if (!buildText.includes(buildQ)) return false
  }

  const commentsQ = filters.comments.trim().toLowerCase()
  if (commentsQ && !(entry.comments ?? '').toLowerCase().includes(commentsQ)) return false

  return true
}

export function filterAndSortMatchupEntries(options: {
  entries: MatchupEntry[]
  filters: MatchupEntriesFilters
  sortKey: MatchupEntriesSortKey
  sortDir: MatchupEntriesSortDir
  build?: Build | null
  t: (key: string, params?: Record<string, unknown>) => string
}): RankedMatchupEntry[] {
  const ranked = options.entries.map((entry, index) => ({ entry, rank: index + 1 }))
  const filtered = ranked.filter(row =>
    entryMatchesFilters(row, options.filters, options.build, options.t)
  )

  const dir = options.sortDir === 'asc' ? 1 : -1
  filtered.sort((a, b) => {
    if (options.sortKey === 'rank') {
      return (a.rank - b.rank) * dir
    }
    const av = matchupDifficultySortValue(a.entry)
    const bv = matchupDifficultySortValue(b.entry)
    if (av === null && bv === null) return (a.rank - b.rank) * dir
    if (av === null) return 1
    if (bv === null) return -1
    if (av === bv) return (a.rank - b.rank) * dir
    return (av - bv) * dir
  })

  return filtered
}

export { DIFFICULTY_BANDS, OUTCOME_KINDS, formatMatchupDifficulty, formatMatchupOutcome }
