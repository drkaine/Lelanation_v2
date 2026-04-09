const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g

const KNOWN_VIDEO_HOSTS = [
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  'vimeo.com',
  'dailymotion.com',
  'tiktok.com',
  'loom.com',
]

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,;:!?)\]]+$/, '')
}

export function extractUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return []
  const matches = text.match(URL_REGEX) ?? []
  const unique = new Set<string>()
  for (const match of matches) {
    const normalized = stripTrailingPunctuation(match.trim())
    if (normalized) unique.add(normalized)
  }
  return [...unique]
}

export function isYouTubeUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    return host.includes('youtube.com') || host.includes('youtu.be')
  } catch {
    return false
  }
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()

    if (host.includes('youtu.be')) {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id || null
    }

    if (host.includes('youtube.com')) {
      const watchId = url.searchParams.get('v')
      if (watchId) return watchId

      const parts = url.pathname.split('/').filter(Boolean)
      const shortsIndex = parts.indexOf('shorts')
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1]
      const liveIndex = parts.indexOf('live')
      if (liveIndex >= 0 && parts[liveIndex + 1]) return parts[liveIndex + 1]
    }
  } catch {
    return null
  }
  return null
}

export function isVideoUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    if (KNOWN_VIDEO_HOSTS.some(videoHost => host.includes(videoHost))) return true
    return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url.pathname)
  } catch {
    return false
  }
}

export function extractVideoUrls(text: string): string[] {
  return extractUrls(text).filter(isVideoUrl)
}

export function getYouTubeThumbnailUrl(rawUrl: string): string | null {
  const videoId = extractYouTubeVideoId(rawUrl)
  if (!videoId) return null
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
}

export function getVideoLinkFallbackTitle(rawUrl: string): string {
  if (isYouTubeUrl(rawUrl)) return 'YouTube'
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace(/^www\./, '')
    if (host.includes('twitch.tv')) return 'Twitch'
    const tail = url.pathname.split('/').filter(Boolean).at(-1)
    if (tail) return `${host} / ${decodeURIComponent(tail)}`
    return host
  } catch {
    return rawUrl
  }
}
