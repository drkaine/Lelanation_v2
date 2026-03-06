/**
 * Ranked division emblems. Served locally after communityDragonSync cron copies them
 * from CommunityDragon to frontend/public/data/community-dragon/ranked-emblem/.
 * @see https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/
 */

/** Local path (used after cron sync). */
const RANKED_EMBLEM_LOCAL_BASE = '/data/community-dragon/ranked-emblem'

/** Fallback CD URL if local image is missing (e.g. before first sync). */
const RANKED_EMBLEM_CD_BASE =
  'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem'

const TIER_TO_EMBLEM: Record<string, string> = {
  IRON: 'emblem-iron.png',
  BRONZE: 'emblem-bronze.png',
  SILVER: 'emblem-silver.png',
  GOLD: 'emblem-gold.png',
  PLATINUM: 'emblem-platinum.png',
  EMERALD: 'emblem-emerald.png',
  DIAMOND: 'emblem-diamond.png',
  MASTER: 'emblem-master.png',
  GRANDMASTER: 'emblem-grandmaster.png',
  CHALLENGER: 'emblem-challenger.png',
}

/**
 * Returns the URL for a ranked tier emblem (local first, then CD fallback), or null if tier is unknown/null.
 */
export function getRankedEmblemUrl(tier: string | null | undefined): string | null {
  if (tier == null || tier === '') return null
  const file = TIER_TO_EMBLEM[tier.toUpperCase()]
  if (!file) return null
  return `${RANKED_EMBLEM_LOCAL_BASE}/${file}`
}

/**
 * Returns the CommunityDragon fallback URL (for onerror / preload).
 */
export function getRankedEmblemCdUrl(tier: string | null | undefined): string | null {
  if (tier == null || tier === '') return null
  const file = TIER_TO_EMBLEM[tier.toUpperCase()]
  if (!file) return null
  return `${RANKED_EMBLEM_CD_BASE}/${file}`
}

export { TIER_TO_EMBLEM }
