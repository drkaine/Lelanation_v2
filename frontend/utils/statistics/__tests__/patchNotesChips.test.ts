import { describe, expect, it } from 'vitest'
import { PATCH_NOTES_CHIPS, applyPatchNotesChip, patchNotesChipActive } from '../patchNotesChips'

const all = new Set(['champion', 'items', 'runes'] as const)

describe('patchNotesChipActive', () => {
  it('lists chips in mockup order', () => {
    expect(PATCH_NOTES_CHIPS).toEqual(['all', 'champion', 'items', 'runes', 'up', 'nerf', 'adjust'])
  })
  it('marks all only when no filter applies', () => {
    expect(patchNotesChipActive('all', all, 'all')).toBe(true)
    expect(patchNotesChipActive('all', new Set(), 'all')).toBe(true)
    expect(patchNotesChipActive('all', all, 'nerf')).toBe(false)
    expect(patchNotesChipActive('all', new Set(['items'] as const), 'all')).toBe(false)
  })
  it('marks a target chip when it is the only target', () => {
    expect(patchNotesChipActive('items', new Set(['items'] as const), 'all')).toBe(true)
    expect(patchNotesChipActive('items', all, 'all')).toBe(false)
  })
  it('marks the change chip in use', () => {
    expect(patchNotesChipActive('nerf', all, 'nerf')).toBe(true)
    expect(patchNotesChipActive('up', all, 'nerf')).toBe(false)
  })
})

describe('applyPatchNotesChip', () => {
  it('resets everything with all', () => {
    expect(applyPatchNotesChip('all', 'nerf')).toEqual({ targets: all, change: 'all' })
  })
  it('narrows targets and keeps change', () => {
    expect(applyPatchNotesChip('runes', 'up')).toEqual({
      targets: new Set(['runes']),
      change: 'up',
    })
  })
  it('toggles change chips without touching targets', () => {
    expect(applyPatchNotesChip('nerf', 'all')).toEqual({ targets: null, change: 'nerf' })
    expect(applyPatchNotesChip('nerf', 'nerf')).toEqual({ targets: null, change: 'all' })
  })
})
