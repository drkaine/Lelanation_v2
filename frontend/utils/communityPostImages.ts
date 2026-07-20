import type { YouTubeVideo } from '~/types/youtube'
import { apiUrl } from '~/utils/apiUrl'

export function normalizeCommunityPostImageUrl(url?: string): string {
  if (!url) return ''
  let normalized = url.startsWith('//') ? `https:${url}` : url
  if (normalized.includes('ggpht.com')) {
    normalized = normalized.replace(/=s\d+-c-fcrop64=[^&?#]+(-rw-nd-v1)?/i, '=s0')
    normalized = normalized.replace(/=s\d+(-rw-nd-v1)?$/i, '=s0')
  }
  return normalized
}

export function getCommunityPostImages(post: YouTubeVideo): string[] {
  const urls = post.imageUrls?.filter(Boolean).map(normalizeCommunityPostImageUrl) ?? []
  if (urls.length > 0) return urls
  if (post.thumbnailUrl) return [normalizeCommunityPostImageUrl(post.thumbnailUrl)]
  return []
}

export async function loadCommunityPostImages(post: YouTubeVideo): Promise<string[]> {
  const cached = getCommunityPostImages(post)
  if (cached.length > 1) return cached

  try {
    const enriched = await $fetch<{ imageUrls?: string[]; thumbnailUrl?: string }>(
      apiUrl(
        `/api/youtube/channels/${encodeURIComponent(post.channelId)}/posts/${encodeURIComponent(post.id)}`
      )
    )
    const urls = enriched.imageUrls?.filter(Boolean).map(normalizeCommunityPostImageUrl) ?? []
    if (urls.length > 0) return urls
    if (enriched.thumbnailUrl) return [normalizeCommunityPostImageUrl(enriched.thumbnailUrl)]
  } catch {
    // Fall back to cached thumbnail when live fetch is unavailable.
  }

  return cached
}
