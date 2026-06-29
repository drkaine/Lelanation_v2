export type MatchupCohortColorOption = {
  id: string
  value: string
}

export const MATCHUP_COHORT_COLORS: MatchupCohortColorOption[] = [
  { id: 'sky', value: '#38bdf8' },
  { id: 'amber', value: '#fbbf24' },
  { id: 'rose', value: '#fb7185' },
  { id: 'violet', value: '#a78bfa' },
  { id: 'emerald', value: '#34d399' },
  { id: 'orange', value: '#fb923c' },
  { id: 'cyan', value: '#22d3ee' },
  { id: 'fuchsia', value: '#e879f9' },
]

export const DEFAULT_MATCHUP_COHORT_COLOR = MATCHUP_COHORT_COLORS[0].value

export const MIN_COHORT_SIZE = 2

export function normalizeOpponentCohortColors(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const allowed = new Set(MATCHUP_COHORT_COLORS.map(option => option.value))
  const next: Record<string, string> = {}
  for (const [opponentId, color] of Object.entries(value as Record<string, unknown>)) {
    if (typeof opponentId !== 'string' || typeof color !== 'string') continue
    if (!allowed.has(color)) continue
    next[opponentId] = color
  }
  return stripSingletonCohortColors(next)
}

export function normalizeActiveCohortColor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_MATCHUP_COHORT_COLOR
  return MATCHUP_COHORT_COLORS.some(option => option.value === value)
    ? value
    : DEFAULT_MATCHUP_COHORT_COLOR
}

export function cohortColorMemberCount(colors: Record<string, string>, color: string): number {
  return Object.values(colors).filter(value => value === color).length
}

export function isRealCohortForColor(colors: Record<string, string>, color: string): boolean {
  return cohortColorMemberCount(colors, color) >= MIN_COHORT_SIZE
}

export function opponentHasVisibleCohortColor(
  colors: Record<string, string>,
  opponentId: string
): boolean {
  const color = colors[opponentId]
  if (!color) return false
  return isRealCohortForColor(colors, color)
}

export function stripSingletonCohortColors(colors: Record<string, string>): Record<string, string> {
  const counts: Record<string, number> = {}
  for (const color of Object.values(colors)) {
    counts[color] = (counts[color] ?? 0) + 1
  }

  const next: Record<string, string> = {}
  for (const [opponentId, color] of Object.entries(colors)) {
    if (counts[color] >= MIN_COHORT_SIZE) {
      next[opponentId] = color
    }
  }
  return next
}

export function buildOpponentCohortColorsForEntries(
  opponentIds: string[],
  color: string
): Record<string, string> {
  if (opponentIds.length < MIN_COHORT_SIZE) return {}
  const next: Record<string, string> = {}
  for (const opponentId of opponentIds) {
    next[opponentId] = color
  }
  return next
}

export function hasAnyCohortAssignments(colors: Record<string, string>): boolean {
  return Object.keys(stripSingletonCohortColors(colors)).length > 0
}

export function realCohortColorMemberCount(colors: Record<string, string>, color: string): number {
  return isRealCohortForColor(colors, color) ? cohortColorMemberCount(colors, color) : 0
}
