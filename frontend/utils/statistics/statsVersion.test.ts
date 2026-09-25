import { describe, expect, it } from 'vitest'
import { compareVersionsDesc, normalizeVersionToPrefix } from './statsVersion'

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
