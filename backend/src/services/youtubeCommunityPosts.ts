import { Result } from '../utils/Result.js'
import { AppError } from '../utils/errors.js'
import { fetchJson, HttpRequestError } from '../utils/httpFetch.js'

export type YouTubeCommunityPostFeedItem = {
  id: string
  title: string
  description: string
  publishedAt: string
  thumbnailUrl: string
  imageUrls: string[]
  channelId: string
  channelTitle: string
  url: string
  kind: 'communityPost'
}

const COMMUNITY_TAB_PARAMS = 'EgVwb3N0c_IGBAoCSgA%3D'
const DEFAULT_INNERTUBE_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20260201.00.00',
    hl: 'fr',
    gl: 'FR',
  },
}

type InnertubeContext = typeof DEFAULT_INNERTUBE_CONTEXT

type CommunityPostRenderer = {
  postId?: string
  contentText?: { runs?: Array<{ text?: string }> }
  publishedTimeText?: { simpleText?: string; runs?: Array<{ text?: string }> }
  backstageAttachment?: {
    postMultiImageRenderer?: {
      images?: Array<{
        backstageImageRenderer?: {
          image?: { thumbnails?: Array<{ url?: string }> }
        }
      }>
    }
    backstageImageRenderer?: {
      image?: { thumbnails?: Array<{ url?: string }> }
    }
    videoRenderer?: {
      videoId?: string
      title?: { simpleText?: string; runs?: Array<{ text?: string }> }
      thumbnail?: { thumbnails?: Array<{ url?: string }> }
    }
  }
}

export function isYouTubeCommunityPostId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('Ug')
}

export function parseRelativePublishedAt(label: string, now = new Date()): string {
  const text = label.trim().toLowerCase()
  if (!text) return now.toISOString()

  const fr = text.match(
    /il y a (\d+)\s*(minute|minutes|min|heure|heures|jour|jours|semaine|semaines|mois|an|ans)/
  )
  if (fr) {
    return shiftDate(now, Number(fr[1]), fr[2]).toISOString()
  }

  const en = text.match(
    /(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago/
  )
  if (en) {
    return shiftDate(now, Number(en[1]), en[2]).toISOString()
  }

  return now.toISOString()
}

function shiftDate(base: Date, amount: number, unit: string): Date {
  const date = new Date(base)
  if (unit.startsWith('min')) date.setMinutes(date.getMinutes() - amount)
  else if (unit.startsWith('heure') || unit.startsWith('hour')) date.setHours(date.getHours() - amount)
  else if (unit.startsWith('jour') || unit.startsWith('day')) date.setDate(date.getDate() - amount)
  else if (unit.startsWith('semaine') || unit.startsWith('week')) date.setDate(date.getDate() - amount * 7)
  else if (unit === 'mois' || unit.startsWith('month')) date.setMonth(date.getMonth() - amount)
  else if (unit.startsWith('an') || unit.startsWith('year')) date.setFullYear(date.getFullYear() - amount)
  return date
}

function normalizeThumbnailUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return normalizeCommunityPostImageUrl(url)
}

export function normalizeCommunityPostImageUrl(url?: string): string {
  if (!url) return ''
  let normalized = url.startsWith('//') ? `https:${url}` : url
  if (normalized.includes('ggpht.com')) {
    normalized = normalized.replace(/=s\d+-c-fcrop64=[^&?#]+(-rw-nd-v1)?/i, '=s0')
    normalized = normalized.replace(/=s\d+(-rw-nd-v1)?$/i, '=s0')
  }
  return normalized
}

function pickLargestThumbnail(thumbnails?: Array<{ url?: string }>): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return ''
  return normalizeThumbnailUrl(thumbnails[thumbnails.length - 1]?.url)
}

function extractPostText(post: CommunityPostRenderer): string {
  return (post.contentText?.runs ?? [])
    .map(run => String(run.text ?? ''))
    .join('')
    .trim()
}

function extractPublishedLabel(post: CommunityPostRenderer): string {
  return (
    post.publishedTimeText?.simpleText?.trim() ||
    post.publishedTimeText?.runs?.map(run => run.text ?? '').join('').trim() ||
    ''
  )
}

function extractPostThumbnail(post: CommunityPostRenderer): string {
  return extractPostImages(post)[0] || ''
}

function extractPostImages(post: CommunityPostRenderer): string[] {
  const attachment = post.backstageAttachment
  if (!attachment) return []

  const urls: string[] = []
  const pushUnique = (url: string) => {
    if (url && !urls.includes(url)) urls.push(url)
  }

  const multi = attachment.postMultiImageRenderer?.images
  if (Array.isArray(multi)) {
    for (const image of multi) {
      pushUnique(
        pickLargestThumbnail(image.backstageImageRenderer?.image?.thumbnails)
      )
    }
  }

  pushUnique(pickLargestThumbnail(attachment.backstageImageRenderer?.image?.thumbnails))
  pushUnique(pickLargestThumbnail(attachment.videoRenderer?.thumbnail?.thumbnails))

  return urls
}

export function parseCommunityPostRenderer(
  post: CommunityPostRenderer,
  params: { channelId: string; channelTitle: string; now?: Date }
): YouTubeCommunityPostFeedItem | null {
  const postId = String(post.postId ?? '').trim()
  if (!postId) return null

  const text = extractPostText(post)
  const title = text.split('\n').find(line => line.trim().length > 0)?.trim() || 'Publication communauté'
  const publishedLabel = extractPublishedLabel(post)
  const publishedAt = publishedLabel
    ? parseRelativePublishedAt(publishedLabel, params.now)
    : (params.now ?? new Date()).toISOString()

  const attachmentVideoId = post.backstageAttachment?.videoRenderer?.videoId
  const url = attachmentVideoId
    ? `https://www.youtube.com/watch?v=${attachmentVideoId}`
    : `https://www.youtube.com/post/${postId}`

  return {
    id: postId,
    title,
    description: text,
    publishedAt,
    thumbnailUrl: extractPostThumbnail(post),
    imageUrls: extractPostImages(post),
    channelId: params.channelId,
    channelTitle: params.channelTitle,
    url,
    kind: 'communityPost',
  }
}

function collectCommunityPostRenderers(root: unknown): CommunityPostRenderer[] {
  const posts: CommunityPostRenderer[] = []

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return
    const candidate = node as CommunityPostRenderer
    if (candidate.postId && candidate.contentText) {
      posts.push(candidate)
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      walk(value)
    }
  }

  walk(root)
  return posts
}

async function loadInnertubeContext(channelId: string): Promise<InnertubeContext> {
  try {
    const page = await fetch(`https://www.youtube.com/channel/${encodeURIComponent(channelId)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!page.ok) return DEFAULT_INNERTUBE_CONTEXT
    const html = await page.text()
    const match = html.match(/"INNERTUBE_CONTEXT":(\{.*?\}),"INNERTUBE_CONTEXT_CLIENT_NAME"/s)
    if (!match) return DEFAULT_INNERTUBE_CONTEXT
    return JSON.parse(match[1]) as InnertubeContext
  } catch {
    return DEFAULT_INNERTUBE_CONTEXT
  }
}

export async function fetchYouTubeCommunityPosts(params: {
  channelId: string
  channelTitle: string
  maxPosts?: number
}): Promise<Result<YouTubeCommunityPostFeedItem[], AppError>> {
  const channelId = params.channelId.trim()
  if (!channelId) {
    return Result.err(new AppError('Missing channelId for community posts', 'VALIDATION_ERROR'))
  }

  const maxPosts = Math.max(1, Math.min(Number(params.maxPosts ?? 40) || 40, 100))
  const now = new Date()

  try {
    const context = await loadInnertubeContext(channelId)
    const payload = await fetchJson<unknown>('https://www.youtube.com/youtubei/v1/browse', {
      method: 'POST',
      timeoutMs: 30_000,
      query: { prettyPrint: 'false' },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      body: {
        context,
        browseId: channelId,
        params: COMMUNITY_TAB_PARAMS,
      },
    })

    const parsed = collectCommunityPostRenderers(payload)
      .map(post =>
        parseCommunityPostRenderer(post, {
          channelId,
          channelTitle: params.channelTitle,
          now,
        })
      )
      .filter((post): post is YouTubeCommunityPostFeedItem => post !== null)

    const byId = new Map<string, YouTubeCommunityPostFeedItem>()
    for (const post of parsed) {
      if (!byId.has(post.id)) byId.set(post.id, post)
    }

    const sorted = [...byId.values()].sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
    )

    return Result.ok(sorted.slice(0, maxPosts))
  } catch (error) {
    if (error instanceof HttpRequestError) {
      return Result.err(
        new AppError(`Failed to fetch YouTube community posts: ${error.message}`, 'EXTERNAL_API_ERROR')
      )
    }
    return Result.err(
      new AppError(
        error instanceof Error ? error.message : 'Failed to fetch YouTube community posts',
        'EXTERNAL_API_ERROR'
      )
    )
  }
}
