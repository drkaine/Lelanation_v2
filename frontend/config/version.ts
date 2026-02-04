/**
 * Fallback game version when VersionStore has not yet loaded or API/static failed.
 * Value comes from backend/data/game/version.json at build time (see nuxt.config.ts).
 */
export function getFallbackGameVersion(): string {
  return useRuntimeConfig().public.fallbackGameVersion || '16.3.1'
}
