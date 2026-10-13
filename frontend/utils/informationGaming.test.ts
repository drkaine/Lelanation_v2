import { describe, expect, it } from 'vitest'
import { INFO_TABS, infoTabFromQuery, infoToc } from './informationGaming'

describe('informationGaming', () => {
  it('info_tab_from_query_falls_back_to_calculations', () => {
    expect(infoTabFromQuery('builds')).toBe('builds')
    expect(infoTabFromQuery('nope')).toBe('calculations')
    expect(infoTabFromQuery(undefined)).toBe('calculations')
    expect(infoTabFromQuery(['data'])).toBe('data')
  })

  it('info_toc_numbers_sections_of_the_tab', () => {
    const toc = infoToc('builds')
    expect(toc.map(e => e.index)).toEqual(['01', '02', '03'])
    expect(toc[0]).toEqual({
      index: '01',
      anchor: 'sec-visibility',
      titleKey: 'information.builds.visibility.title',
      icon: 'mdi:eye-outline',
    })
  })

  it('info_tabs_reference_only_existing_locale_keys', async () => {
    const fr = (await import('../i18n/locales/fr.json')).default as Record<string, unknown>
    const en = (await import('../i18n/locales/en.json')).default as Record<string, unknown>
    const get = (o: unknown, path: string) =>
      path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], o)
    const keys = INFO_TABS.flatMap(tab => [
      tab.labelKey,
      `informationTest.tabIntro.${tab.id}`,
      ...tab.sections.map(s => s.titleKey),
    ])
    keys.push('informationTest.eyebrow', 'informationTest.toc')
    for (const key of keys) {
      expect(typeof get(fr, key), `fr ${key}`).toBe('string')
      expect(typeof get(en, key), `en ${key}`).toBe('string')
    }
  })
})
