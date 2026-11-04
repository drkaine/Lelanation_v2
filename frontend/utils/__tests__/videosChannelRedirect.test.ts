import { describe, expect, it } from 'vitest'
import { legacyVideosChannelRedirect } from '../videosChannelRedirect'

describe('legacyVideosChannelRedirect', () => {
  it('redirige une ancienne page de chaîne vers le catalogue', () => {
    expect(legacyVideosChannelRedirect('/videos/UCabc')).toBe('/videos?channelId=UCabc')
    expect(legacyVideosChannelRedirect('/en/videos/UCabc/')).toBe('/en/videos?channelId=UCabc')
  })

  it('redirige les anciennes pages guides par champion vers /guides/champion', () => {
    expect(legacyVideosChannelRedirect('/videos/champions')).toBe('/guides/champion')
    expect(legacyVideosChannelRedirect('/en/videos/champions/')).toBe('/en/guides/champion')
    expect(legacyVideosChannelRedirect('/videos/champions/ahri')).toBe('/guides/champion/ahri')
    expect(legacyVideosChannelRedirect('/en/videos/champions/Lee%20Sin')).toBe(
      '/en/guides/champion/Lee%20Sin'
    )
  })

  it('ignore le catalogue et les fichiers internes', () => {
    expect(legacyVideosChannelRedirect('/videos')).toBeNull()
    expect(legacyVideosChannelRedirect('/videos/_payload.json')).toBeNull()
    expect(legacyVideosChannelRedirect('/guides/champion')).toBeNull()
  })
})
