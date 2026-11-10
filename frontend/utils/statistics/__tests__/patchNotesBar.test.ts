import { describe, expect, it } from 'vitest'
import { patchNotesBar, PATCH_NOTES_TARGET_SEGMENTS } from '../patchNotesBar'

describe('patchNotesBar', () => {
  it('width proportional to max total, segments keep counts', () => {
    const bar = patchNotesBar({ countUp: 2, countNerf: 1, countAjust: 1, totalChanges: 4 }, 8)
    expect(bar.widthPct).toBe(50)
    expect(bar.segments).toEqual([
      { kind: 'up', count: 2 },
      { kind: 'nerf', count: 1 },
      { kind: 'ajust', count: 1 },
    ])
  })

  it('drops empty segments and clamps width', () => {
    const bar = patchNotesBar({ countUp: 0, countNerf: 3, countAjust: 0, totalChanges: 3 }, 2)
    expect(bar.widthPct).toBe(100)
    expect(bar.segments).toEqual([{ kind: 'nerf', count: 3 }])
  })

  it('zero max → zero width', () => {
    expect(
      patchNotesBar({ countUp: 0, countNerf: 0, countAjust: 0, totalChanges: 0 }, 0).widthPct
    ).toBe(0)
  })

  it('target segments order', () => {
    expect(PATCH_NOTES_TARGET_SEGMENTS).toEqual(['all', 'champion', 'items', 'runes'])
  })
})
