import { describe, expect, it } from 'vitest'
import { buildMatchesTag, hasLelarivaBuild } from '../buildTagFilter'

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
