import { describe, expect, it } from 'vitest'
import { theorycraftTooltipTestUtils } from '../../../../src/services/TheorycraftDataBuilderService.js'

const { tooltipFields, serializeGameData } = theorycraftTooltipTestUtils

describe('theorycraft JSON exporté (taille)', () => {
  it('tooltip : html + texte seulement, sans doublons descriptionParsed/parsedText', () => {
    const fields = tooltipFields('<b>Q</b>', 'Q')
    expect(fields).toEqual({ descriptionHtml: '<b>Q</b>', descriptionText: 'Q' })
    expect(Object.keys(fields)).not.toContain('descriptionParsed')
    expect(Object.keys(fields)).not.toContain('parsedText')
  })

  it('JSON minifié (sans indentation)', () => {
    const out = serializeGameData({ a: 1, b: { c: [1, 2] } })
    expect(out).toBe('{"a":1,"b":{"c":[1,2]}}')
    expect(JSON.parse(out)).toEqual({ a: 1, b: { c: [1, 2] } })
  })
})
