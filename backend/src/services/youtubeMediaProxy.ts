/**
 * Proxy des médias tiers (vignettes YouTube, métadonnées oEmbed) : le navigateur du visiteur
 * ne contacte que notre serveur, aucune IP ni en-tête n'est transmis à Google ou noembed.
 */

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

const IMAGE_HOSTS = ['i.ytimg.com', 'i9.ytimg.com', 'img.youtube.com', 'yt3.googleusercontent.com']
const IMAGE_HOST_SUFFIXES = ['.ggpht.com']
const VIDEO_HOSTS = [
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  'vimeo.com',
  'dailymotion.com',
  'tiktok.com',
  'loom.com',
]
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 8000

function parseUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    return new URL(raw.trim())
  } catch {
    return null
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

export function parseProxiedImageUrl(raw: unknown): URL | null {
  const url = parseUrl(raw)
  if (!url || url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase()
  const allowed =
    IMAGE_HOSTS.includes(host) || IMAGE_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
  return allowed ? url : null
}

export function parseOEmbedTargetUrl(raw: unknown): URL | null {
  const url = parseUrl(raw)
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null
  const host = url.hostname.toLowerCase()
  return VIDEO_HOSTS.some(domain => hostMatches(host, domain)) ? url : null
}

export async function fetchProxiedImage(
  url: URL,
  fetchImpl: FetchImpl = fetch,
  maxBytes = MAX_IMAGE_BYTES
): Promise<{ contentType: string; body: Buffer } | null> {
  try {
    const res = await fetchImpl(url.toString(), {
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
    const contentType = res.headers.get('content-type') ?? ''
    if (!res.ok || !contentType.startsWith('image/')) return null
    const body = Buffer.from(await res.arrayBuffer())
    if (body.length > maxBytes) return null
    return { contentType, body }
  } catch {
    return null
  }
}

export type OEmbedSummary = {
  title?: string
  author_name?: string
  provider_name?: string
  thumbnail_url?: string
}

export async function fetchOEmbed(
  target: URL,
  fetchImpl: FetchImpl = fetch
): Promise<OEmbedSummary | null> {
  try {
    const endpoint = `https://noembed.com/embed?url=${encodeURIComponent(target.toString())}`
    const res = await fetchImpl(endpoint, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const pick = (key: keyof OEmbedSummary) =>
      typeof data[key] === 'string' ? (data[key] as string) : undefined
    return {
      title: pick('title'),
      author_name: pick('author_name'),
      provider_name: pick('provider_name'),
      thumbnail_url: pick('thumbnail_url'),
    }
  } catch {
    return null
  }
}
