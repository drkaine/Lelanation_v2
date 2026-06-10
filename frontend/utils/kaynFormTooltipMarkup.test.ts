import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterKaynDetailedTexts, filterKaynTooltipHtml } from './kaynFormTooltipMarkup.js'

test('filterKaynDetailedTexts keeps neutral and matching form sections', () => {
  const sections = [
    '<span class="kayn-form-darkin">Tueur darkin :</span> bonus rouge',
    '<span class="kayn-form-shadow">Assassin de l\'ombre :</span> bonus bleu',
    '<span class="tooltip-rules">Règle neutre</span>',
  ]
  assert.deepEqual(filterKaynDetailedTexts(sections, 1), [
    '<span class="kayn-form-darkin">Tueur darkin :</span> bonus rouge',
    '<span class="tooltip-rules">Règle neutre</span>',
  ])
  assert.deepEqual(filterKaynDetailedTexts(sections, 2), [
    '<span class="kayn-form-shadow">Assassin de l\'ombre :</span> bonus bleu',
    '<span class="tooltip-rules">Règle neutre</span>',
  ])
})

test('filterKaynTooltipHtml splits on double line breaks', () => {
  const html =
    '<span class="kayn-form-darkin">Darkin :</span> heal<br><br><span class="kayn-form-shadow">Assassin :</span> burst'
  assert.equal(
    filterKaynTooltipHtml(html, 2),
    '<span class="kayn-form-shadow">Assassin :</span> burst'
  )
})
