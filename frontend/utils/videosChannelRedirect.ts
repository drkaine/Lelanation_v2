/** Anciennes pages guides par champion : /videos/champions[/:slug] → /guides/champion[/:slug]. */
const LEGACY_CHAMPION_GUIDES_RE = /^(\/en)?\/videos\/champions(?:\/([^/?#]+))?\/?$/

/**
 * Cible de redirection 301 d'une ancienne URL sous /videos/ :
 * guides par champion → /guides/champion, ancienne page /videos/:channelId → catalogue. Sinon null.
 */
export function legacyVideosChannelRedirect(path: string): string | null {
  const guides = path.match(LEGACY_CHAMPION_GUIDES_RE)
  if (guides) return `${guides[1] ?? ''}/guides/champion${guides[2] ? `/${guides[2]}` : ''}`

  const channelRaw = path.match(/^\/(?:en\/)?videos\/([^/?#]+)\/?$/)?.[1]
  if (!channelRaw) return null
  const channelId = decodeURIComponent(channelRaw)
  // Nuxt client payload and other internal assets (/_payload.json, /_nuxt, …).
  if (channelId.startsWith('_')) return null
  const localePrefix = path.startsWith('/en/') ? '/en' : ''
  return `${localePrefix}/videos?channelId=${encodeURIComponent(channelId)}`
}
