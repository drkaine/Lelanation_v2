import { describe, expect, it } from 'vitest'
import { learnSectionActiveId } from '../navLearnSection'

describe('learnSectionActiveId', () => {
  it('reconnaît items, vidéos et guides, avec ou sans préfixe de langue', () => {
    expect(learnSectionActiveId('/items')).toBe('items')
    expect(learnSectionActiveId('/en/items/')).toBe('items')
    expect(learnSectionActiveId('/videos')).toBe('videos')
    expect(learnSectionActiveId('/en/videos/some-channel')).toBe('videos')
    expect(learnSectionActiveId('/guides/champion')).toBe('guides')
    expect(learnSectionActiveId('/en/guides/champion/ahri')).toBe('guides')
  })

  it('ignore les autres pages', () => {
    expect(learnSectionActiveId('/')).toBeNull()
    expect(learnSectionActiveId('/builds/create')).toBeNull()
    expect(learnSectionActiveId('/statistics/champion')).toBeNull()
    expect(learnSectionActiveId('/itemsets')).toBeNull()
    expect(learnSectionActiveId('/builds/items')).toBeNull()
  })
})
