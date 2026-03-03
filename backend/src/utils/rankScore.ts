/**
 * Map tier+division to a numeric score and back for averaging match rank.
 */
const TIERS = ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'] as const
const TIER_ORDER: Record<string, number> = Object.fromEntries(TIERS.map((t, i) => [t, i]))
const DIVISION_ORDER: Record<string, number> = { I: 4, II: 3, III: 2, IV: 1 }

export function rankToScore(tier: string, division: string | null, lp: number | null): number {
  const t = TIER_ORDER[tier?.toUpperCase() ?? ''] ?? 0
  const d = division ? DIVISION_ORDER[division.toUpperCase()] ?? 2 : 2
  const divIdx = d - 1
  const base = t * 4 + divIdx
  const lpFraction = lp != null && lp >= 0 ? lp / 100 : 0
  return base + lpFraction
}

export function scoreToRank(score: number): { tier: string; division: string } {
  if (score <= 0) return { tier: 'IRON', division: 'IV' }
  const base = Math.floor(score)
  const t = Math.min(TIERS.length - 1, Math.floor(base / 4))
  const divIdx = base % 4
  const tier = TIERS[t] ?? 'IRON'
  const divisions = ['IV', 'III', 'II', 'I']
  const division = divisions[divIdx] ?? 'IV'
  return { tier, division }
}

export function rankStringToScore(rank: string): number {
  const parts = rank?.trim().split('_') ?? []
  const tier = parts[0] ?? ''
  const division = parts[1] ?? null
  return rankToScore(tier, division, null)
}

export function formatRankString(tier: string, division: string): string {
  return `${tier}_${division}`
}
