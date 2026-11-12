import { describe, expect, it } from 'vitest'
import {
  parseGuideSecrets,
  withGuideSecret,
  withoutGuideSecret,
} from '~/utils/matchupGuideEditSecrets'

describe('matchupGuideEditSecrets', () => {
  it('parseGuideSecrets_returns_empty_when_storage_is_missing_or_malformed', () => {
    // Arrange / Act / Assert
    expect(parseGuideSecrets(null)).toEqual({})
    expect(parseGuideSecrets('not json')).toEqual({})
    expect(parseGuideSecrets('[1,2]')).toEqual({})
  })

  it('parseGuideSecrets_keeps_only_non_empty_strings_when_storage_is_mixed', () => {
    const raw = JSON.stringify({ a: 'secret-a', b: 12, c: '  ', d: 'secret-d' })

    const result = parseGuideSecrets(raw)

    expect(result).toEqual({ a: 'secret-a', d: 'secret-d' })
  })

  it('withGuideSecret_adds_secret_without_mutating_when_secret_is_valid', () => {
    const before = { a: 'secret-a' }

    const after = withGuideSecret(before, 'b', ' secret-b ')

    expect(after).toEqual({ a: 'secret-a', b: 'secret-b' })
    expect(before).toEqual({ a: 'secret-a' })
  })

  it('withGuideSecret_returns_same_map_when_secret_is_not_a_string', () => {
    const before = { a: 'secret-a' }

    expect(withGuideSecret(before, 'b', undefined)).toBe(before)
    expect(withGuideSecret(before, '', 'x')).toBe(before)
  })

  it('withoutGuideSecret_removes_entry_when_guide_is_deleted', () => {
    const before = { a: 'secret-a', b: 'secret-b' }

    const after = withoutGuideSecret(before, 'a')

    expect(after).toEqual({ b: 'secret-b' })
    expect(before).toEqual({ a: 'secret-a', b: 'secret-b' })
  })
})
