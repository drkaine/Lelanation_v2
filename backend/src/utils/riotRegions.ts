/**
 * Riot platform regions for Europe cluster (Match-v5 Europe).
 * MVP: euw1, eun1, tr1, ru, me1.
 */
export const EUROPE_PLATFORMS = ['euw1', 'eun1', 'tr1', 'ru', 'me1'] as const
export type EuropePlatform = (typeof EUROPE_PLATFORMS)[number]

export function isEuropePlatform(region: string): region is EuropePlatform {
  return EUROPE_PLATFORMS.includes(region.toLowerCase() as EuropePlatform)
}

export function normalizeEuropeRegion(region: string): EuropePlatform | null {
  const r = region.trim().toLowerCase()
  return isEuropePlatform(r) ? (r as EuropePlatform) : null
}
