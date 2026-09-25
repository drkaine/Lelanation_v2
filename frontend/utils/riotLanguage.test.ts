import { describe, expect, it } from 'vitest'
import { riotLanguage } from './riotLanguage'

describe('riotLanguage', () => {
  it('maps app locales to Riot Data Dragon languages, French by default', () => {
    expect(riotLanguage('en')).toBe('en_US')
    expect(riotLanguage('fr')).toBe('fr_FR')
    expect(riotLanguage('de')).toBe('fr_FR')
    expect(riotLanguage(undefined)).toBe('fr_FR')
  })
})
