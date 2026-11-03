import { describe, expect, it } from 'vitest'
import { buildFlipLabelKey, buildTopFlipAction, toggleBuildFlip } from '../buildCardFlip'

describe('toggleBuildFlip', () => {
  it('retourne la card du build visé seulement', () => {
    const next = toggleBuildFlip({ b2: true }, 'b1')
    expect(next).toEqual({ b1: true, b2: true })
    expect(toggleBuildFlip(next, 'b1')).toEqual({ b1: false, b2: true })
  })
})

describe('buildFlipLabelKey', () => {
  it('propose la description côté build, le build côté description', () => {
    expect(buildFlipLabelKey(false)).toBe('buildDetailPage.viewDescription')
    expect(buildFlipLabelKey(true)).toBe('buildDetailPage.viewBuild')
  })
})

describe('buildTopFlipAction', () => {
  it('ferme la card guide avant de retourner la description', () => {
    expect(buildTopFlipAction({ guideShown: true })).toBe('close-guide')
    expect(buildTopFlipAction({ guideShown: false })).toBe('toggle-description')
  })
})
