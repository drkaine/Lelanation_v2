import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMatchIdsTypeParamOptionsFromPortalHtml } from '../../src/services/RiotMatchIdsTypeParamMonitor.js'

const SAMPLE_HTML = `
<div id="execute_inputs_match-v5_GET_getMatchIdsByPUUID">
  <select name="type" class="form-control">
    <option></option>
    <option>ranked</option>
    <option> normal</option>
    <option> tourney</option>
    <option> tutorial</option>
  </select>
</div>
`

test('parseMatchIdsTypeParamOptionsFromPortalHtml trims and deduplicates options', () => {
  assert.deepEqual(parseMatchIdsTypeParamOptionsFromPortalHtml(SAMPLE_HTML), [
    'normal',
    'ranked',
    'tourney',
    'tutorial',
  ])
})

test('parseMatchIdsTypeParamOptionsFromPortalHtml throws when select is missing', () => {
  assert.throws(
    () => parseMatchIdsTypeParamOptionsFromPortalHtml('<div></div>'),
    /match_ids_type_select_not_found/,
  )
})
