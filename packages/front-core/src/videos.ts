import type { YouTubeVideo } from '@lelanation/shared-types'

export type VideoCategory = 'all' | 'builds' | 'lobby' | 'other'
export type VideoFormat = 'all' | 'videos' | 'shorts'

export interface VideoFilters {
  query: string
  channelId: string
  category: VideoCategory
  format: VideoFormat
}

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
}

export function detectVideoCategory(title: string): Exclude<VideoCategory, 'all'> {
  const normalized = normalizeText(title)
  if (/lobby/.test(normalized)) return 'lobby'
  if (/\bbuilds?\b/.test(normalized)) return 'builds'
  return 'other'
}

export function detectVideoFormat(video: YouTubeVideo): Exclude<VideoFormat, 'all'> {
  if (typeof video.isShort === 'boolean') return video.isShort ? 'shorts' : 'videos'

  const title = video.title || ''
  const description = video.description || ''
  const normalized = normalizeText(`${title} ${description}`)
  if (/\bshorts?\b/.test(normalized) || /#shorts?\b/.test(normalized)) return 'shorts'

  const hasHashtags = /#\w+/.test(title)
  if (hasHashtags && title.length <= 90) return 'shorts'
  return 'videos'
}

export function dedupeAndSortVideos(videos: YouTubeVideo[]): YouTubeVideo[] {
  const byId = new Map<string, YouTubeVideo>()
  for (const video of videos) byId.set(video.id, video)
  const deduped = [...byId.values()]

  const toTime = (iso: string | undefined) => {
    const time = Date.parse(String(iso || ''))
    return Number.isFinite(time) ? time : -Infinity
  }

  return deduped.sort((a, b) => {
    const dt = toTime(b.publishedAt) - toTime(a.publishedAt)
    if (dt !== 0) return dt
    const byTitle = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
    if (byTitle !== 0) return byTitle
    return a.id.localeCompare(b.id, 'fr', { sensitivity: 'base' })
  })
}

export function applyVideoFilters(videos: YouTubeVideo[], filters: VideoFilters): YouTubeVideo[] {
  const query = normalizeText(filters.query.trim())

  return videos.filter(video => {
    if (filters.channelId !== 'all' && video.channelId !== filters.channelId) return false
    if (filters.category !== 'all' && detectVideoCategory(video.title) !== filters.category) return false
    if (filters.format !== 'all' && detectVideoFormat(video) !== filters.format) return false
    if (query && !normalizeText(video.title).includes(query)) return false
    return true
  })
}

export function normalizeVideosPerPage(value: number): 0 | 10 | 20 | 30 {
  if (value === 0 || value === 10 || value === 20 || value === 30) return value
  return 20
}
