import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { theorycraftTooltipTestUtils } from './TheorycraftDataBuilderService.js'

const {
  extractBinDataValues,
  extractBinCalculations,
  inferSpellSlotIndex,
} = theorycraftTooltipTestUtils

const CACHE_DIR = join(process.cwd(), 'data/theorycraft-cache')

function collectBinSpells(championBin: Record<string, unknown>): Array<{
  scriptName: string
  spell: Record<string, unknown>
}> {
  const spells: Array<{ scriptName: string; spell: Record<string, unknown> }> = []
  for (const value of Object.values(championBin)) {
    if (!value || typeof value !== 'object') continue
    const spell = asObject((value as Record<string, unknown>).mSpell)
    if (Object.keys(spell).length === 0) continue
    const scriptName = String((value as Record<string, unknown>).mScriptName ?? '')
    spells.push({ scriptName, spell })
  }
  return spells
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

test('all cached champion bins resolve spell calculations used in tooltips', () => {
  const binFiles = readdirSync(CACHE_DIR).filter((name) => name.startsWith('cdragon-bin-') && name.endsWith('.json'))
  assert.ok(binFiles.length > 100, `expected many bin files, got ${binFiles.length}`)

  const failures: string[] = []
  for (const file of binFiles) {
    const championId = file.replace('cdragon-bin-', '').replace('.json', '')
    const championBin = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf-8')) as Record<string, unknown>
    for (const { scriptName, spell } of collectBinSpells(championBin)) {
      const calculations = asObject(spell.mSpellCalculations)
      if (Object.keys(calculations).length === 0) continue
      const maxRank = 5
      const slotIndex = inferSpellSlotIndex({ id: scriptName })
      const dataValues = extractBinDataValues(spell, maxRank)
      const built = extractBinCalculations(spell, dataValues, { maxRank, slotIndex })
      for (const calc of built) {
        if (/^\{[0-9a-f]+\}$/i.test(calc.key)) continue
        const raw = calculations[calc.key] ?? calculations[Object.keys(calculations).find((k) => k.toLowerCase() === calc.key) ?? '']
        if (!raw) continue
        const parts = Array.isArray(asObject(raw).mFormulaParts) ? asObject(raw).mFormulaParts : []
        if (parts.length === 0) continue
        if (!calc.expression && calc.baseValues.length === 0) {
          failures.push(`${championId}/${scriptName}:${calc.key}`)
        }
      }
    }
  }

  // A few passives use hashed/conditional bin calculations not exposed in spell tooltips.
  const allowedExceptions = new Set([
    'draven/dravenpassive:dravenpassivegoldearned',
    'draven/dravenpassive:dravenpassivehighestbounty',
    'kindred/kindredpassivemanager:qmarkbonus',
    'kindred/kindredpassivemanager:wmarkbonus',
    'kindred/kindredpassivemanager:emarkbonus',
    'ksante/ksantep:percenthealthdamage',
    'lulu/luluw:totalms',
    'zaahen/zaahenpassive:revivepercentcalc',
    'zaahen/zaahenpassive:percentbonusadcalc',
    'zed/zedpassive:totaldamage',
    'zilean/heightenedlearning:totalxp',
  ])
  const unexpected = failures.filter((entry) => !allowedExceptions.has(entry.toLowerCase()))

  if (unexpected.length > 0) {
    assert.fail(
      `Unresolved calculations (${unexpected.length}): ${unexpected.slice(0, 20).join(', ')}${unexpected.length > 20 ? '…' : ''}`
    )
  }
})
