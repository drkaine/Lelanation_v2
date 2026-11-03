import { describe, expect, it } from 'vitest'
import { buildMatchesTag, hasGuidedBuild, hasLelarivaBuild } from '../buildTagFilter'

describe('buildMatchesTag', () => {
  it('matches_lelariva_on_badge_or_team_shared', () => {
    expect(buildMatchesTag({ lelarivaBadge: true }, 'lelariva')).toBe(true)
    expect(buildMatchesTag({ teamShared: true }, 'lelariva')).toBe(true)
    expect(buildMatchesTag({ tags: ['pro'] }, 'lelariva')).toBe(false)
  })

  it('matches_regular_tags_on_build_or_sub_builds', () => {
    expect(buildMatchesTag({ tags: ['pro'] }, 'pro')).toBe(true)
    expect(buildMatchesTag({ subBuilds: [{ tags: ['otp'] }] }, 'otp')).toBe(true)
    expect(buildMatchesTag({ tags: [] }, 'otp')).toBe(false)
  })
})

describe('hasLelarivaBuild', () => {
  it('is_true_only_when_a_public_build_has_the_badge', () => {
    expect(hasLelarivaBuild([{ tags: [] }, { lelarivaBadge: true }])).toBe(true)
    expect(hasLelarivaBuild([{ lelarivaBadge: true, visibility: 'private' }])).toBe(false)
    expect(hasLelarivaBuild([{ tags: [] }])).toBe(false)
    expect(hasLelarivaBuild([])).toBe(false)
  })
})

describe('guide tag', () => {
  it('matches_builds_whose_id_has_a_linked_guide', () => {
    const guided = new Set(['b1'])
    expect(buildMatchesTag({ id: 'b1' }, 'guide', guided)).toBe(true)
    expect(buildMatchesTag({ id: 'b2' }, 'guide', guided)).toBe(false)
    expect(buildMatchesTag({ id: 'b1' }, 'guide')).toBe(false)
  })

  it('has_guided_build_only_for_public_builds_with_guide', () => {
    const guided = new Set(['b1'])
    expect(hasGuidedBuild([{ id: 'b1' }], guided)).toBe(true)
    expect(hasGuidedBuild([{ id: 'b1', visibility: 'private' }], guided)).toBe(false)
    expect(hasGuidedBuild([{ id: 'b2' }], guided)).toBe(false)
  })
})
