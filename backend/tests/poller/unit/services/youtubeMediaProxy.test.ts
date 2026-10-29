import { describe, expect, it, vi } from 'vitest'
import {
  fetchOEmbed,
  fetchProxiedImage,
  parseOEmbedTargetUrl,
  parseProxiedImageUrl,
} from '../../../../src/services/youtubeMediaProxy.js'

function response(body: BodyInit, init: ResponseInit & { headers?: Record<string, string> } = {}) {
  return new Response(body, init)
}

describe('parseProxiedImageUrl', () => {
  it('accepts YouTube image hosts over https', () => {
    expect(parseProxiedImageUrl('https://i.ytimg.com/vi/abc/hqdefault.jpg')?.hostname).toBe('i.ytimg.com')
    expect(parseProxiedImageUrl('https://yt3.ggpht.com/xyz=s0')?.hostname).toBe('yt3.ggpht.com')
    expect(parseProxiedImageUrl('https://yt3.googleusercontent.com/a')?.hostname).toBe(
      'yt3.googleusercontent.com'
    )
  })

  it('rejects other hosts, http and look-alike domains', () => {
    expect(parseProxiedImageUrl('https://evil.com/a.jpg')).toBeNull()
    expect(parseProxiedImageUrl('http://i.ytimg.com/vi/abc/hqdefault.jpg')).toBeNull()
    expect(parseProxiedImageUrl('https://i.ytimg.com.evil.com/a.jpg')).toBeNull()
    expect(parseProxiedImageUrl('https://127.0.0.1/a.jpg')).toBeNull()
    expect(parseProxiedImageUrl('not a url')).toBeNull()
    expect(parseProxiedImageUrl(undefined)).toBeNull()
  })
})

describe('parseOEmbedTargetUrl', () => {
  it('accepts known video hosts', () => {
    expect(parseOEmbedTargetUrl('https://www.youtube.com/watch?v=abc')).not.toBeNull()
    expect(parseOEmbedTargetUrl('https://youtu.be/abc')).not.toBeNull()
    expect(parseOEmbedTargetUrl('https://www.twitch.tv/videos/1')).not.toBeNull()
  })

  it('rejects unknown hosts', () => {
    expect(parseOEmbedTargetUrl('https://example.com/watch?v=abc')).toBeNull()
    expect(parseOEmbedTargetUrl('https://youtube.com.evil.com/x')).toBeNull()
    expect(parseOEmbedTargetUrl('')).toBeNull()
  })
})

describe('fetchProxiedImage', () => {
  it('returns the image bytes and content type', async () => {
    const fetchImpl = vi.fn(async () =>
      response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
    )
    const result = await fetchProxiedImage(new URL('https://i.ytimg.com/a.jpg'), fetchImpl)
    expect(result).toEqual({ contentType: 'image/jpeg', body: Buffer.from([1, 2, 3]) })
    expect(fetchImpl).toHaveBeenCalledWith('https://i.ytimg.com/a.jpg', expect.objectContaining({ redirect: 'error' }))
  })

  it('rejects non-image responses and upstream errors', async () => {
    const html = vi.fn(async () =>
      response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })
    )
    expect(await fetchProxiedImage(new URL('https://i.ytimg.com/a.jpg'), html)).toBeNull()
    const notFound = vi.fn(async () => response('', { status: 404 }))
    expect(await fetchProxiedImage(new URL('https://i.ytimg.com/a.jpg'), notFound)).toBeNull()
  })

  it('rejects images over the size limit', async () => {
    const big = vi.fn(async () =>
      response(new Uint8Array(10), { status: 200, headers: { 'content-type': 'image/png' } })
    )
    expect(await fetchProxiedImage(new URL('https://i.ytimg.com/a.jpg'), big, 5)).toBeNull()
  })
})

describe('fetchOEmbed', () => {
  it('keeps only display fields', async () => {
    const fetchImpl = vi.fn(async () =>
      response(
        JSON.stringify({
          title: 'Video',
          author_name: 'Chan',
          provider_name: 'YouTube',
          thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
          html: '<iframe>',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )
    const result = await fetchOEmbed(new URL('https://youtu.be/abc'), fetchImpl)
    expect(result).toEqual({
      title: 'Video',
      author_name: 'Chan',
      provider_name: 'YouTube',
      thumbnail_url: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
    })
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(
      'https://noembed.com/embed?url=https%3A%2F%2Fyoutu.be%2Fabc'
    )
  })

  it('returns null on upstream failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('down')
    })
    expect(await fetchOEmbed(new URL('https://youtu.be/abc'), fetchImpl)).toBeNull()
  })
})
