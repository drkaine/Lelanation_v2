import { describe, expect, it } from 'vitest'
import { matchupsFallbackVersion } from '../matchupsFallbackVersion'

const versions = [{ version: '16.21' }, { version: '16.20' }, { version: '16.19' }]

describe('matchupsFallbackVersion', () => {
  it('propose le patch précédent', () => {
    expect(matchupsFallbackVersion(versions, '16.21')).toBe('16.20')
  })
  it('version vide : précédent de la plus récente', () => {
    expect(matchupsFallbackVersion(versions, '')).toBe('16.20')
  })
  it('dernière version connue : rien', () => {
    expect(matchupsFallbackVersion(versions, '16.19')).toBeNull()
  })
  it('version inconnue : rien', () => {
    expect(matchupsFallbackVersion(versions, '15.1')).toBeNull()
  })
})
