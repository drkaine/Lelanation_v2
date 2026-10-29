/**
 * Médias tiers servis via notre backend : le navigateur du visiteur ne contacte ni Google ni noembed.
 */

const IMAGE_PROXY_PATH = '/api/youtube/image'
const PROXIED_IMAGE_HOSTS = [
  'i.ytimg.com',
  'i9.ytimg.com',
  'img.youtube.com',
  'yt3.googleusercontent.com',
]

function isProxiedImageHost(host: string): boolean {
  return PROXIED_IMAGE_HOSTS.includes(host) || host.endsWith('.ggpht.com')
}

export function proxiedImageUrl(url: string): string {
  if (!url) return url
  const absolute = url.startsWith('//') ? `https:${url}` : url
  try {
    const parsed = new URL(absolute)
    if (parsed.protocol !== 'https:' || !isProxiedImageHost(parsed.hostname.toLowerCase()))
      return url
    return `${IMAGE_PROXY_PATH}?url=${encodeURIComponent(parsed.toString())}`
  } catch {
    return url
  }
}

/** Lecteur YouTube « confidentialité renforcée » : pas de cookie avant la lecture. */
export function youtubeEmbedUrl(videoId: string | null | undefined): string | null {
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
}

export function oembedProxyPath(videoUrl: string): string {
  return `/api/youtube/oembed?url=${encodeURIComponent(videoUrl)}`
}
