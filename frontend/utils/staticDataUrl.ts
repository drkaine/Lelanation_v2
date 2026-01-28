/**
 * Generate URLs for static game data and images served from frontend public directory
 * These are served directly by Nuxt (no API call needed)
 */

/**
 * Get static game data JSON URL
 * Example: /data/game/16.1.1/fr_FR/champion.json
 */
export function getGameDataUrl(
  version: string,
  type: 'champion' | 'championFull' | 'item' | 'runesReforged' | 'summoner',
  language: string = 'fr_FR'
): string {
  return `/data/game/${version}/${language}/${type}.json`
}

/**
 * Get static version info URL
 */
export function getVersionUrl(): string {
  return '/data/game/version.json'
}

/**
 * Get static image URL
 * Uses static files from frontend public directory
 * Falls back to API if static files are not available
 * Example: /images/game/16.1.1/champion/Aatrox.png
 */
export function getStaticImageUrl(
  version: string,
  type: 'champion' | 'item' | 'spell' | 'rune' | 'champion-spell',
  filename: string,
  subPath?: string
): string {
  // Use static files from frontend public directory
  // Images should be copied from backend to frontend/public/images/game/ during sync
  // If images are not available, they will fail to load and can be handled by onerror handlers
  if (subPath) {
    return `/images/game/${version}/${type}/${subPath}/${filename}`
  }
  return `/images/game/${version}/${type}/${filename}`
}

/**
 * Get static YouTube channel data URL
 * Example: /data/youtube/UC1234567890.json
 */
export function getYouTubeChannelDataUrl(channelId: string): string {
  return `/data/youtube/${channelId}.json`
}

/**
 * Get static YouTube channels config URL
 * Example: /data/youtube/channels.json
 */
export function getYouTubeChannelsConfigUrl(): string {
  return '/data/youtube/channels.json'
}
