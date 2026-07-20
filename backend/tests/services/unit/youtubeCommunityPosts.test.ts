import { describe, expect, it } from 'vitest'
import {
  isYouTubeCommunityPostId,
  parseCommunityPostRenderer,
  parseRelativePublishedAt,
} from '../../../src/services/youtubeCommunityPosts.js'

describe('youtubeCommunityPosts', () => {
  it('detects community post ids', () => {
    expect(isYouTubeCommunityPostId('UgkxqKwUJJ3giPbgTBTw2XeTxYFQzzMo0SQA')).toBe(true)
    expect(isYouTubeCommunityPostId('dQw4w9WgXcQ')).toBe(false)
  })

  it('parses relative french dates', () => {
    const now = new Date('2026-07-20T12:00:00.000Z')
    expect(parseRelativePublishedAt('il y a 7 jours', now)).toBe('2026-07-13T12:00:00.000Z')
    expect(parseRelativePublishedAt('il y a 1 jour', now)).toBe('2026-07-19T12:00:00.000Z')
  })

  it('maps a community post renderer to feed item', () => {
    const post = parseCommunityPostRenderer(
      {
        postId: 'UgkxqKwUJJ3giPbgTBTw2XeTxYFQzzMo0SQA',
        publishedTimeText: { simpleText: 'il y a 7 jours' },
        contentText: {
          runs: [{ text: 'Nouveau Format Visuel - Les builds META en image ! Commençons par GP !' }],
        },
        backstageAttachment: {
          postMultiImageRenderer: {
            images: [
              {
                backstageImageRenderer: {
                  image: {
                    thumbnails: [{ url: 'https://yt3.ggpht.com/example.jpg' }],
                  },
                },
              },
            ],
          },
        },
      },
      {
        channelId: 'UCz0D_xJRQamxRlTrec5j4oA',
        channelTitle: 'Lelariva',
        now: new Date('2026-07-20T12:00:00.000Z'),
      }
    )

    expect(post).toMatchObject({
      id: 'UgkxqKwUJJ3giPbgTBTw2XeTxYFQzzMo0SQA',
      kind: 'communityPost',
      channelId: 'UCz0D_xJRQamxRlTrec5j4oA',
      channelTitle: 'Lelariva',
      title: 'Nouveau Format Visuel - Les builds META en image ! Commençons par GP !',
      url: 'https://www.youtube.com/post/UgkxqKwUJJ3giPbgTBTw2XeTxYFQzzMo0SQA',
      thumbnailUrl: 'https://yt3.ggpht.com/example.jpg',
      imageUrls: ['https://yt3.ggpht.com/example.jpg'],
      publishedAt: '2026-07-13T12:00:00.000Z',
    })
  })

  it('extracts all images from multi-image posts', () => {
    const post = parseCommunityPostRenderer(
      {
        postId: 'UgMultiImageExample',
        contentText: { runs: [{ text: 'Multi image post' }] },
        backstageAttachment: {
          postMultiImageRenderer: {
            images: [
              {
                backstageImageRenderer: {
                  image: { thumbnails: [{ url: 'https://yt3.ggpht.com/a.jpg' }] },
                },
              },
              {
                backstageImageRenderer: {
                  image: { thumbnails: [{ url: 'https://yt3.ggpht.com/b.jpg' }] },
                },
              },
            ],
          },
        },
      },
      {
        channelId: 'UCexample',
        channelTitle: 'Example',
      }
    )

    expect(post?.imageUrls).toEqual([
      'https://yt3.ggpht.com/a.jpg',
      'https://yt3.ggpht.com/b.jpg',
    ])
  })
})
