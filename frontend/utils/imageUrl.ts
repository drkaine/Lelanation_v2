import { getStaticImageUrl } from './staticDataUrl.js'

/**
 * Generate local image URL for champions, items, spells, runes
 * Uses static files (served directly by Nuxt, no API call)
 * These are copied from backend to frontend/public during sync
 */
export function getImageUrl(
  type: 'champion' | 'item' | 'spell' | 'rune' | 'champion-spell',
  version: string,
  filename: string,
  subPath?: string
): string {
  // Use static files (served directly by Nuxt, no API call)
  // These are copied from backend to frontend/public during sync
  return getStaticImageUrl(version, type, filename, subPath)
}

/**
 * Get champion image URL
 */
export function getChampionImageUrl(version: string, imageName: string): string {
  return getImageUrl('champion', version, imageName)
}

/**
 * Get item image URL
 */
export function getItemImageUrl(version: string, imageName: string): string {
  return getImageUrl('item', version, imageName)
}

/**
 * Get summoner spell image URL
 */
export function getSpellImageUrl(version: string, imageName: string): string {
  return getImageUrl('spell', version, imageName)
}

/**
 * Get champion spell image URL
 */
export function getChampionSpellImageUrl(
  version: string,
  championId: string,
  imageName: string
): string {
  return getImageUrl('champion-spell', version, imageName, championId)
}

/**
 * Get champion passive image URL
 */
export function getChampionPassiveImageUrl(version: string, imageName: string): string {
  return getImageUrl('champion-spell', version, imageName, 'passive')
}

/**
 * Get rune path icon URL
 * Icon format: "perk-images/Styles/7200_Domination.png"
 * Stored as: /images/game/{version}/rune/paths/7200_Domination.png
 */
export function getRunePathImageUrl(version: string, icon: string): string {
  // Extract filename from icon path (e.g., "perk-images/Styles/7200_Domination.png" -> "7200_Domination.png")
  const filename = icon.split('/').pop() || icon
  return getImageUrl('rune', version, filename, 'paths')
}

/**
 * Get rune icon URL
 * Icon format: "perk-images/Styles/Domination/Electrocute/Electrocute.png"
 * Stored as: /images/game/{version}/rune/runes/Electrocute.png
 */
export function getRuneImageUrl(version: string, icon: string): string {
  // Extract filename from icon path (e.g., "perk-images/Styles/Domination/Electrocute/Electrocute.png" -> "Electrocute.png")
  const filename = icon.split('/').pop() || icon
  return getImageUrl('rune', version, filename, 'runes')
}
