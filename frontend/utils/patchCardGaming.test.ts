import { describe, expect, it } from 'vitest'
import {
  PATCH_VERDICT_TONES,
  groupChangesBySection,
  patchChangeCounts,
  statDelta,
  statDeltaTone,
} from './patchCardGaming'
import type { StatChange } from '~/stores/PatchNotesStore'

const change = (type: StatChange['type'], extra: Partial<StatChange> = {}): StatChange => ({
  stat: 'Dégâts',
  before: '40',
  after: '55',
  type,
  ...extra,
})

describe('PATCH_VERDICT_TONES', () => {
  it('verdict_tones_use_site_tokens', () => {
    expect(PATCH_VERDICT_TONES.buff).toBe('info')
    expect(PATCH_VERDICT_TONES.nerf).toBe('error')
    expect(PATCH_VERDICT_TONES.adjustment).toBe('accent')
    expect(Object.keys(PATCH_VERDICT_TONES).sort()).toEqual(
      ['adjustment', 'buff', 'new', 'nerf', 'removed'].sort()
    )
  })
})

describe('patchChangeCounts', () => {
  it('counts_up_down_and_adjust_ignoring_text', () => {
    const counts = patchChangeCounts([
      change('buff'),
      change('buff'),
      change('new'),
      change('nerf'),
      change('removed'),
      change('adjustment'),
      change('text'),
    ])
    expect(counts).toEqual({ up: 3, down: 2, adjust: 1 })
  })
})

describe('statDelta', () => {
  it('delta_plain_numbers', () => {
    expect(statDelta('40', '55')).toBe('+15')
    expect(statDelta('55', '40')).toBe('-15')
  })

  it('delta_keeps_shared_unit', () => {
    expect(statDelta('9s', '8s')).toBe('-1s')
    expect(statDelta('40%', '45%')).toBe('+5%')
    expect(statDelta('9 s', '8 s')).toBe('-1 s')
  })

  it('delta_decimals_and_comma', () => {
    expect(statDelta('0.65', '0.7')).toBe('+0.05')
    expect(statDelta('1,5', '2')).toBe('+0.5')
  })

  it('delta_null_when_not_comparable', () => {
    expect(statDelta('40 / 55 / 70', '45 / 60 / 75')).toBeNull()
    expect(statDelta('9s', '8%')).toBeNull()
    expect(statDelta('', '8')).toBeNull()
    expect(statDelta('Ancien texte', 'Nouveau texte')).toBeNull()
    expect(statDelta('40', '40')).toBeNull()
  })
})

describe('statDeltaTone', () => {
  it('delta_tone_follows_change_type_not_sign', () => {
    expect(statDeltaTone('buff')).toBe('info')
    expect(statDeltaTone('nerf')).toBe('error')
    expect(statDeltaTone('adjustment')).toBe('accent')
    expect(statDeltaTone('text')).toBe('muted')
  })
})

describe('groupChangesBySection', () => {
  it('groups_by_subcategory_keeping_order', () => {
    const groups = groupChangesBySection(
      [
        change('buff', { subCategory: 'Q - Frappe' }),
        change('nerf', { subCategory: 'Stats de base' }),
        change('buff', { subCategory: 'Q - Frappe' }),
      ],
      ''
    )
    expect(groups.map(g => [g.title, g.changes.length])).toEqual([
      ['Q - Frappe', 2],
      ['Stats de base', 1],
    ])
  })

  it('falls_back_to_entity_subcategory', () => {
    const groups = groupChangesBySection([change('buff')], 'Général')
    expect(groups[0]?.title).toBe('Général')
  })
})
