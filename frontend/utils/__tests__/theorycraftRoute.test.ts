import { describe, expect, it } from 'vitest'
import {
  isBuilderCreateRoutePath,
  isTheorycraftRoutePath,
  stripLocalePrefix,
} from '../theorycraftRoute'

describe('theorycraftRoute', () => {
  it('stripLocalePrefix removes /en', () => {
    expect(stripLocalePrefix('/builds/theorycraft')).toBe('/builds/theorycraft')
    expect(stripLocalePrefix('/en/builds/theorycraft')).toBe('/builds/theorycraft')
    expect(stripLocalePrefix('/en/builds/create/theorycraft')).toBe('/builds/create/theorycraft')
  })

  it('isTheorycraftRoutePath matches legacy and builder paths', () => {
    expect(isTheorycraftRoutePath('/builds/theorycraft')).toBe(true)
    expect(isTheorycraftRoutePath('/en/builds/theorycraft')).toBe(true)
    expect(isTheorycraftRoutePath('/builds/create/theorycraft')).toBe(true)
    expect(isTheorycraftRoutePath('/en/builds/create/theorycraft')).toBe(true)
    expect(isTheorycraftRoutePath('/builds/create')).toBe(false)
  })

  it('isBuilderCreateRoutePath matches create steps', () => {
    expect(isBuilderCreateRoutePath('/builds/create/info')).toBe(true)
    expect(isBuilderCreateRoutePath('/en/builds/create/theorycraft')).toBe(true)
    expect(isBuilderCreateRoutePath('/builds/theorycraft')).toBe(false)
  })
})
