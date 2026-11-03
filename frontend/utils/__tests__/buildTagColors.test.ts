import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BUILD_TAG_COLORS,
  BUILD_TAG_REGION,
  buildTagChipStyle,
  buildTagUsesDarkText,
} from '../buildTagColors'

const regions = JSON.parse(
  readFileSync(resolve(__dirname, '../../public/data/regions.json'), 'utf8')
).regionsData as Record<string, [string, string]>

describe('buildTagColors', () => {
  it('uses_the_region_colors_of_the_card_borders', () => {
    expect(BUILD_TAG_REGION).toEqual({
      pro: 'demacia',
      otp: 'freljord',
      exotique: 'void',
      troll: 'ionia',
      notes: 'bandle',
      lelariva: 'shadow_isles',
      guide: 'noxus',
    })
    for (const [tag, region] of Object.entries(BUILD_TAG_REGION)) {
      expect(BUILD_TAG_COLORS[tag as keyof typeof BUILD_TAG_COLORS]).toEqual(regions[region])
    }
  })

  it('builds_css_vars_for_a_chip', () => {
    expect(buildTagChipStyle('guide')).toEqual({ '--tag-g1': '#790000', '--tag-g2': '#240101' })
  })

  it('uses_dark_text_on_light_gradients', () => {
    expect(buildTagUsesDarkText('troll')).toBe(true)
    expect(buildTagUsesDarkText('pro')).toBe(true)
    expect(buildTagUsesDarkText('guide')).toBe(false)
    expect(buildTagUsesDarkText('otp')).toBe(false)
  })
})
