import { describe, expect, it } from 'vitest'
import {
  BUILD_UUID_REGEX,
  generateEditSecret,
  isValidBuildUuid,
  readBuildEditSecret,
  resolveBuildFilePath,
  stripEditSecret,
  verifyEditSecret,
} from '../../../src/utils/buildEditAuth.js'

const UUID = '11111111-1111-4111-8111-111111111111'

describe('buildEditAuth', () => {
  it('validates UUID v4 format', () => {
    expect(isValidBuildUuid(UUID)).toBe(true)
    expect(isValidBuildUuid('not-a-uuid')).toBe(false)
    expect(isValidBuildUuid('../etc/passwd')).toBe(false)
    expect(BUILD_UUID_REGEX.test(`${UUID}.json`)).toBe(false)
  })

  it('resolves paths only under buildsDir', () => {
    expect(resolveBuildFilePath(UUID, false)).toContain(`${UUID}.json`)
    expect(resolveBuildFilePath('../../../etc/passwd', false)).toBeNull()
  })

  it('strips editSecret from API payloads', () => {
    const cleaned = stripEditSecret({ id: UUID, editSecret: 'abc', name: 'x' })
    expect(cleaned).toEqual({ id: UUID, name: 'x' })
    expect('editSecret' in cleaned).toBe(false)
  })

  it('allows create without header', () => {
    const result = verifyEditSecret(null, undefined)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.editSecret).toHaveLength(64)
  })

  it('allows legacy update without header once', () => {
    const result = verifyEditSecret({ id: UUID }, undefined)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.editSecret).toHaveLength(64)
  })

  it('requires header when secret exists', () => {
    const secret = generateEditSecret()
    const existing = { id: UUID, editSecret: secret }
    expect(verifyEditSecret(existing, secret).ok).toBe(true)
    expect(verifyEditSecret(existing, 'wrong').ok).toBe(false)
    expect(verifyEditSecret(existing, undefined).ok).toBe(false)
  })

  it('reads edit secret from build record', () => {
    expect(readBuildEditSecret({ editSecret: '  abc  ' })).toBe('abc')
    expect(readBuildEditSecret({ editSecret: '' })).toBeNull()
    expect(readBuildEditSecret(null)).toBeNull()
  })
})
