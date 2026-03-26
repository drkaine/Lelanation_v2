import { describe, expect, it } from 'vitest'
import { applyVideoFilters, dedupeAndSortVideos, normalizeVideosPerPage } from '../videos'
import type { YouTubeVideo } from '@lelanation/shared-types'

const videos: YouTubeVideo[] = [
  {
    id: 'a',
    title: 'Builds guide',
    description: '',
    publishedAt: '2026-01-02T00:00:00.000Z',
    thumbnailUrl: '',
    channelId: 'c1',
    channelTitle: 'C1',
    url: '',
  },
  {
    id: 'b',
    title: '#shorts lobby',
    description: '',
    publishedAt: '2026-01-03T00:00:00.000Z',
    thumbnailUrl: '',
    channelId: 'c2',
    channelTitle: 'C2',
    url: '',
  },
]

describe('videos core', () => {
  it('filters by category and channel', () => {
    const result = applyVideoFilters(videos, {
      query: '',
      channelId: 'c1',
      category: 'builds',
      format: 'all',
    })
    expect(result.map(v => v.id)).toEqual(['a'])
  })

  it('dedupes and sorts by date desc', () => {
    const result = dedupeAndSortVideos([videos[0], videos[1], videos[0]])
    expect(result.map(v => v.id)).toEqual(['b', 'a'])
  })

  it('normalizes videos per page', () => {
    expect(normalizeVideosPerPage(99)).toBe(20)
    expect(normalizeVideosPerPage(0)).toBe(0)
  })
})
