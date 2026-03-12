/**
 * Pure functions for stats calculations (winrate, pickrate, banrate, PBI, tier score, rates).
 * Used by StatsOverviewService, TierListService, StatsAbandonsService, etc.
 * See docs/stats-calculations.md for definitions.
 */

/** Winrate in percent: 100 * wins / games. Returns 0 if games === 0. */
export function winratePercent(wins: number, games: number): number {
  if (games <= 0 || !Number.isFinite(games)) return 0
  return (wins / games) * 100
}

/** Winrate in percent rounded to one decimal (e.g. 52.3). */
export function winratePercentRounded(wins: number, games: number, decimals = 1): number {
  const wr = winratePercent(wins, games)
  const factor = 10 ** decimals
  return Math.round(wr * factor) / factor
}

/** Pickrate: 100 * games / totalMatches (games = match count where champion was picked). */
export function pickratePercent(games: number, totalMatches: number): number {
  if (totalMatches <= 0 || !Number.isFinite(totalMatches)) return 0
  return (games / totalMatches) * 100
}

/** Banrate: 100 * banCount / totalMatches (banCount = match count where champion was banned). */
export function banratePercent(banCount: number, totalMatches: number): number {
  if (totalMatches <= 0 || !Number.isFinite(totalMatches)) return 0
  return (banCount / totalMatches) * 100
}

/** Generic rate in percent: 100 * count / total (e.g. remake rate, surrender rate). */
export function ratePercent(count: number, total: number): number {
  if (total <= 0 || !Number.isFinite(total)) return 0
  return (count / total) * 100
}

/**
 * PBI (Performance Beyond Impact): (winrate_pct - 50) * pickrate_pct / (100 - banrate_pct).
 * Returns 0 if (100 - banrate_pct) <= 0.
 */
export function pbi(winratePct: number, pickratePct: number, banratePct: number): number {
  const denom = 100 - banratePct
  if (denom <= 0) return 0
  return ((winratePct - 50) * pickratePct) / denom
}

/**
 * Tier score for tier list: (winrate - 0.5) * sqrt(games).
 * winrate is in [0, 1] (proportion).
 */
export function tierScore(winrateProportion: number, games: number): number {
  if (!Number.isFinite(games) || games < 0) return 0
  return (winrateProportion - 0.5) * Math.sqrt(games)
}

/** Presence: (games + banCount) / totalMatches as percent. */
export function presencePercent(games: number, banCount: number, totalMatches: number): number {
  if (totalMatches <= 0 || !Number.isFinite(totalMatches)) return 0
  return ((games + banCount) / totalMatches) * 100
}
