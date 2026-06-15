const DEFAULT_FALLBACK_GAME_VERSION = '16.3.1'

let cachedFallbackGameVersion: string | null = null

/**
 * Fallback game version when VersionStore has not yet loaded or API/static failed.
 * Value comes from backend/data/game/version.json at build time (see nuxt.config.ts).
 * Cached at first successful read so lazy head resolvers (prerender) never call useRuntimeConfig after teardown.
 */
export function getFallbackGameVersion(): string {
  if (cachedFallbackGameVersion) return cachedFallbackGameVersion
  try {
    cachedFallbackGameVersion =
      useRuntimeConfig().public.fallbackGameVersion || DEFAULT_FALLBACK_GAME_VERSION
  } catch {
    cachedFallbackGameVersion = DEFAULT_FALLBACK_GAME_VERSION
  }
  return cachedFallbackGameVersion
}
