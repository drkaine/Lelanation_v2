import { describe, expect, it } from 'vitest'
import { oembedProxyPath, proxiedImageUrl, youtubeEmbedUrl } from './externalMedia'

describe('proxiedImageUrl', () => {
  it('routes YouTube images through our backend', () => {
    expect(proxiedImageUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toBe(
      '/api/youtube/image?url=https%3A%2F%2Fi.ytimg.com%2Fvi%2Fabc%2Fhqdefault.jpg'
    )
    expect(proxiedImageUrl('//yt3.ggpht.com/x=s0')).toBe(
      '/api/youtube/image?url=https%3A%2F%2Fyt3.ggpht.com%2Fx%3Ds0'
    )
  })

  it('leaves local and unknown urls untouched', () => {
    expect(proxiedImageUrl('/images/a.png')).toBe('/images/a.png')
    expect(proxiedImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(proxiedImageUrl('')).toBe('')
  })

  it('does not double-proxy', () => {
    const once = proxiedImageUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg')
    expect(proxiedImageUrl(once)).toBe(once)
  })
})

describe('youtubeEmbedUrl', () => {
  it('uses the privacy-enhanced domain', () => {
    expect(youtubeEmbedUrl('abc_1')).toBe('https://www.youtube-nocookie.com/embed/abc_1')
    expect(youtubeEmbedUrl(null)).toBeNull()
  })
})

describe('oembedProxyPath', () => {
  it('points to the backend oEmbed proxy', () => {
    expect(oembedProxyPath('https://youtu.be/abc')).toBe(
      '/api/youtube/oembed?url=https%3A%2F%2Fyoutu.be%2Fabc'
    )
  })
})
