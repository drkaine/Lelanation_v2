import { describe, expect, it } from 'vitest'
import { PATCH_TAB_ICONS, PATCH_TAG_TILES, countPatchTags, patchNeighbors } from './patchGaming'

describe('patchNeighbors', () => {
  const versions = ['16.16', '16.15', '16.14']
  it('neighbors_older_and_newer_from_newest_first_list', () => {
    expect(patchNeighbors(versions, '16.15')).toEqual({ older: '16.14', newer: '16.16' })
    expect(patchNeighbors(versions, '16.16')).toEqual({ older: '16.15', newer: null })
    expect(patchNeighbors(versions, '16.14')).toEqual({ older: null, newer: '16.15' })
  })

  it('neighbors_null_when_unknown', () => {
    expect(patchNeighbors(versions, '9.9')).toEqual({ older: null, newer: null })
  })
})

describe('countPatchTags', () => {
  it('count_tags_in_filter_order_skipping_empty', () => {
    const counts = countPatchTags(['nerf', 'buff', 'buff', null, 'removed'])
    expect(counts).toEqual([
      { id: 'buff', count: 2 },
      { id: 'nerf', count: 1 },
      { id: 'removed', count: 1 },
    ])
  })
})

describe('PATCH_TAG_TILES', () => {
  it('tag_tiles_cover_every_summary_type', () => {
    expect(Object.keys(PATCH_TAG_TILES).sort()).toEqual(
      ['adjustment', 'buff', 'new', 'nerf', 'removed'].sort()
    )
    for (const tile of Object.values(PATCH_TAG_TILES)) {
      expect(tile.icon.startsWith('mdi:')).toBe(true)
    }
  })
})

describe('PATCH_TAB_ICONS', () => {
  it('tab_icons_cover_every_content_tab', () => {
    expect(Object.keys(PATCH_TAB_ICONS).sort()).toEqual(
      ['bugfix', 'champions', 'items', 'optimizations', 'runes', 'summary', 'systems'].sort()
    )
  })
})
