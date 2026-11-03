/** Pages réelles sous /videos/ (ne sont pas d'anciennes pages de chaîne). */
const VIDEOS_SUBPAGES = new Set(['champions'])

/** Cible de redirection d'une ancienne page /videos/:channelId vers le catalogue, sinon null. */
export function legacyVideosChannelRedirect(path: string): string | null {
  const channelRaw = path.match(/^\/(?:en\/)?videos\/([^/?#]+)\/?$/)?.[1]
  if (!channelRaw) return null
  const channelId = decodeURIComponent(channelRaw)
  // Nuxt client payload and other internal assets (/_payload.json, /_nuxt, …).
  if (channelId.startsWith('_') || VIDEOS_SUBPAGES.has(channelId)) return null
  const localePrefix = path.startsWith('/en/') ? '/en' : ''
  return `${localePrefix}/videos?channelId=${encodeURIComponent(channelId)}`
}
