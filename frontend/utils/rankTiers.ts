/** Rank tiers used in statistics filters and watchlist (matches statistics index). */
export const RANK_TIERS = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
] as const

export type RankTierCode = (typeof RANK_TIERS)[number]
