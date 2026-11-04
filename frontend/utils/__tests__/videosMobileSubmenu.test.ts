import { describe, expect, it } from 'vitest'
import { VIDEOS_SUBMENU_ITEMS, videosSubmenuActiveId } from '../videosMobileSubmenu'

describe('videosMobileSubmenu', () => {
  it('groupe Apprendre : Items, Vidéos et Guides', () => {
    expect(VIDEOS_SUBMENU_ITEMS.map(i => [i.id, i.path, i.labelKey])).toEqual([
      ['items', '/items', 'itemShopPage.navLabel'],
      ['videos', '/videos', 'nav.videos'],
      ['champions', '/guides/champion', 'nav.championGuides'],
    ])
  })

  it('active Guides sur /guides/champion (avec ou sans locale), Vidéos ailleurs sous /videos', () => {
    expect(videosSubmenuActiveId('/guides/champion')).toBe('champions')
    expect(videosSubmenuActiveId('/en/guides/champion/ahri')).toBe('champions')
    expect(videosSubmenuActiveId('/videos')).toBe('videos')
    expect(videosSubmenuActiveId('/en/videos/UCabc')).toBe('videos')
    expect(videosSubmenuActiveId('/guides/championship')).toBeNull()
    expect(videosSubmenuActiveId('/builds')).toBeNull()
    expect(videosSubmenuActiveId('/items')).toBe('items')
    expect(videosSubmenuActiveId('/en/items')).toBe('items')
    expect(videosSubmenuActiveId('/builds/items')).toBeNull()
  })
})
