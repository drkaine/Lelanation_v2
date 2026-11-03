import { describe, expect, it } from 'vitest'
import { legacyVideosChannelRedirect } from '../videosChannelRedirect'

describe('legacyVideosChannelRedirect', () => {
  it('redirige une ancienne page de chaîne vers le catalogue', () => {
    expect(legacyVideosChannelRedirect('/videos/UCabc')).toBe('/videos?channelId=UCabc')
    expect(legacyVideosChannelRedirect('/en/videos/UCabc/')).toBe('/en/videos?channelId=UCabc')
  })

  it('laisse passer les pages guides par champion', () => {
    expect(legacyVideosChannelRedirect('/videos/champions')).toBeNull()
    expect(legacyVideosChannelRedirect('/en/videos/champions/')).toBeNull()
    expect(legacyVideosChannelRedirect('/videos/champions/ahri')).toBeNull()
  })

  it('ignore le catalogue et les fichiers internes', () => {
    expect(legacyVideosChannelRedirect('/videos')).toBeNull()
    expect(legacyVideosChannelRedirect('/videos/_payload.json')).toBeNull()
  })
})
