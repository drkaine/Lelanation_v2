import { describe, expect, it } from 'vitest'
import {
  compareVersionsDesc,
  normalizeVersionToPrefix,
  pickStatsVersionFilter,
  thinPatchNotice,
} from './statsVersion'

describe('compareVersionsDesc', () => {
  it('sorts_versions_newest_first_numerically', () => {
    expect(['16.9', '16.12', '15.24'].sort(compareVersionsDesc)).toEqual(['16.12', '16.9', '15.24'])
  })

  it('treats_missing_parts_as_zero', () => {
    expect(compareVersionsDesc('16.1', '16.1.0')).not.toBe(0)
  })
})

describe('normalizeVersionToPrefix', () => {
  it('keeps_major_minor_when_full_version_given', () => {
    expect(normalizeVersionToPrefix('16.3.123')).toBe('16.3')
  })

  it('returns_null_when_empty', () => {
    expect(normalizeVersionToPrefix('')).toBeNull()
  })
})

describe('pickStatsVersionFilter', () => {
  const versions = [
    { version: '16.22', matchCount: 10 },
    { version: '16.21', matchCount: 5 },
    { version: '16.20', matchCount: 0 },
  ]

  it('keeps the current filter when it has matches', () => {
    expect(pickStatsVersionFilter({ current: '16.21', queryVersion: '16.22', versions })).toBe(
      '16.21'
    )
  })

  it('uses ?version= from the URL when the filter is not applied yet (hydration race)', () => {
    expect(pickStatsVersionFilter({ current: '', queryVersion: '16.21', versions })).toBe('16.21')
  })

  it('falls back to the newest patch with matches when URL version has no data', () => {
    expect(pickStatsVersionFilter({ current: '', queryVersion: '16.20', versions })).toBe('16.22')
    expect(pickStatsVersionFilter({ current: '15.1', queryVersion: '', versions })).toBe('16.22')
  })

  it('keeps the current value when no versions are known yet', () => {
    expect(pickStatsVersionFilter({ current: '16.21', queryVersion: '', versions: [] })).toBe(
      '16.21'
    )
  })
})

describe('pickStatsVersionFilter — patch trop maigre', () => {
  it('ignore un nouveau patch quasi vide par défaut', () => {
    expect(
      pickStatsVersionFilter({
        current: '',
        queryVersion: '',
        versions: [
          { version: '16.22', matchCount: 93 },
          { version: '16.21', matchCount: 51929 },
        ],
      })
    ).toBe('16.21')
  })
  it('garde le patch maigre si demandé explicitement', () => {
    expect(
      pickStatsVersionFilter({
        current: '',
        queryVersion: '16.22',
        versions: [
          { version: '16.22', matchCount: 93 },
          { version: '16.21', matchCount: 51929 },
        ],
      })
    ).toBe('16.22')
  })
})

describe('thinPatchNotice', () => {
  const versions = [
    { version: '16.22', matchCount: 182 },
    { version: '16.21', matchCount: 51000 },
    { version: '16.20', matchCount: 48000 },
  ]

  it('flags_selected_thin_patch_and_points_to_reliable_one', () => {
    expect(thinPatchNotice({ selected: '16.22', versions })).toEqual({
      mode: 'selected',
      thinVersion: '16.22',
      matchCount: 182,
      needed: 2550,
      reliableVersion: '16.21',
    })
  })

  it('flags_new_patch_when_viewing_reliable_fallback', () => {
    expect(thinPatchNotice({ selected: '16.21', versions })?.mode).toBe('fallback')
  })

  it('returns_null_when_newest_patch_has_enough_matches', () => {
    expect(
      thinPatchNotice({ selected: '16.21', versions: versions.filter(v => v.version !== '16.22') })
    ).toBeNull()
  })

  it('returns_null_when_viewing_older_patch_on_purpose', () => {
    expect(thinPatchNotice({ selected: '16.20', versions })).toBeNull()
  })
})
