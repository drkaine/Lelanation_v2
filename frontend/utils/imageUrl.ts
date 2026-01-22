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
 * Get rune path icon URL
 */
export function getRunePathImageUrl(icon: string): string {
  // Rune icons use a different path structure: /img/perk-images/...
  // For now, fallback to CDN since rune paths are more complex
  // TODO: Update when rune image structure is finalized
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`
}

/**
 * Get rune icon URL
 */
export function getRuneImageUrl(icon: string): string {
  // Rune icons use a different path structure: /img/perk-images/...
  // For now, fallback to CDN since rune paths are more complex
  // TODO: Update when rune image structure is finalized
  return `https://ddragon.leagueoflegends.com/cdn/img/${icon}`
}
