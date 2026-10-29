import { describe, expect, it } from 'vitest'
import {
  LEGAL_DOCS,
  LEGAL_LAST_UPDATE,
  legalSectionAnchor,
  legalToc,
  recentDownloadCount,
} from './legalPageGaming'

describe('legalPageGaming', () => {
  it('legal_section_anchor_is_prefixed_and_kebab', () => {
    expect(legalSectionAnchor('dataCollected')).toBe('sec-data-collected')
    expect(legalSectionAnchor('ip')).toBe('sec-ip')
  })

  it('legal_toc_numbers_sections_in_order', () => {
    const toc = legalToc('privacy')
    expect(toc[0]).toEqual({
      index: '01',
      anchor: 'sec-controller',
      titleKey: 'privacy.controller.title',
    })
    expect(toc.map(e => e.index)).toEqual(
      LEGAL_DOCS.privacy.map((_, i) => String(i + 1).padStart(2, '0'))
    )
  })

  it('legal_docs_reference_only_existing_locale_keys', async () => {
    const fr = (await import('../i18n/locales/fr.json')).default as Record<string, unknown>
    const en = (await import('../i18n/locales/en.json')).default as Record<string, unknown>
    const get = (o: unknown, path: string) =>
      path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], o)
    for (const doc of ['privacy', 'legal'] as const) {
      for (const section of LEGAL_DOCS[doc]) {
        const keys = [
          `${doc}.${section.key}.title`,
          ...section.blocks.flatMap(b =>
            b.kind === 'list' ? b.items : b.kind === 'link' ? [b.label, b.href] : [b.text]
          ),
        ]
        for (const key of keys) {
          expect(typeof get(fr, key), `fr ${key}`).toBe('string')
          expect(typeof get(en, key), `en ${key}`).toBe('string')
        }
      }
    }
  })

  it('legal_docs_cover_mandatory_sections', () => {
    const keys = (doc: 'privacy' | 'legal') => LEGAL_DOCS[doc].map(s => s.key)
    expect(keys('legal')).toEqual(expect.arrayContaining(['editor', 'host', 'riotData', 'contact']))
    expect(keys('privacy')).toEqual(
      expect.arrayContaining([
        'controller',
        'riotData',
        'analytics',
        'retention',
        'rights',
        'contact',
      ])
    )
  })

  it('contact_sections_render_the_contact_email', () => {
    for (const doc of ['privacy', 'legal'] as const) {
      const contact = LEGAL_DOCS[doc].find(s => s.key === 'contact')!
      expect(contact.blocks.some(b => b.kind === 'contact')).toBe(true)
    }
  })

  it('last_update_is_a_fixed_iso_date', () => {
    expect(LEGAL_LAST_UPDATE).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('recent_download_count_sums_last_n_days_including_today', () => {
    const daily = { '2026-10-13': 4, '2026-10-10': 2, '2026-10-06': 9, '2026-10-07': 1 }
    expect(recentDownloadCount(daily, 7, new Date('2026-10-13T12:00:00Z'))).toBe(7)
    expect(recentDownloadCount({}, 7, new Date('2026-10-13T12:00:00Z'))).toBe(0)
  })
})
