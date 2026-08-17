/**
 * Vérification systématique des exports theorycraft de TOUS les champions,
 * pour la version courante (lue dans version.json) : cette suite revalide
 * donc automatiquement chaque nouveau patch après sync.
 *
 * Invariants calibrés sur les bornes réelles du jeu (avec marge) : ils
 * détectent la corruption de données (0 cassés, NaN, tokens non résolus,
 * ratios invalides…), pas les changements d'équilibrage.
 *
 * Contexte : DDragon a déjà publié attackdamageperlevel=0 pour tous les
 * champions (bug Riot). Le générateur corrige via le bin CDragon ; cette
 * suite garantit qu'une régression de ce type ne repasse plus inaperçue.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dataRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data', 'game')
const { currentVersion } = JSON.parse(readFileSync(join(dataRoot, 'version.json'), 'utf-8')) as {
  currentVersion: string
}
const LOCALES = ['fr_FR', 'en_US'] as const

/** Champions sans croissance d'AD par design (l'AD vient de leur passif). */
const ZERO_AD_GROWTH_WHITELIST = new Set(['Senna'])

const ALLOWED_RATIO_STATS = new Set([
  'AP',
  'totalAD',
  'bonusAD',
  'totalHP',
  'bonusHP',
  'maxHealth',
  'armor',
  'bonusArmor',
  'magicResist',
  'bonusMagicResist',
  'critChance',
  'critDamage',
  'maxMana',
])

/**
 * Séries fractionnaires légitimes vérifiées contre le wiki (valeurs plates,
 * pas des pourcentages) : Sett P régénère 0.15–2 PV par 5 % de PV manquants,
 * Tryndamere Q rend 0.5–2.3 PV par point de Fureur. Toute AUTRE anomalie
 * (double « %% », fraction sans %) fait échouer le test.
 */
const KNOWN_TEXT_ANOMALIES = new Set(['Sett|P|descriptionText', 'Tryndamere|Q|detailedText'])

const NUMBER_SERIES_RE = /(?:\d+(?:\.\d+)?\s*\/\s*){2,}\d+(?:\.\d+)?/g

/** Miroir de l'audit du générateur (auditDescriptionText). */
function auditDescriptionText(text: string): string[] {
  const issues: string[] = []
  if (text.includes('%%')) issues.push('double %')
  for (const match of text.matchAll(NUMBER_SERIES_RE)) {
    const values = (match[0].match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
    const fractionCount = values.filter(v => v < 1).length
    if (fractionCount < 2 || values.some(v => v >= 3)) continue
    const end = (match.index ?? 0) + match[0].length
    const tail = text.slice(end, end + 8)
    if (/^\s*%/.test(tail) || /^\s*(?:sec|s\b)/.test(tail)) continue
    issues.push(`fraction sans %: ${match[0].slice(0, 30)}`)
  }
  return issues
}

interface ExportedChampion {
  id: string
  baseStats: Record<string, number>
  growthStats: Record<string, number>
  passive?: { descriptionText?: string; detailedText?: string }
  spells: Array<{
    slot: string
    maxRank?: number
    descriptionText?: string
    detailedText?: string
    calculations?: Array<{
      key: string
      baseValues?: number[]
      ratios?: Array<{ stat: string; coefficient: number[] }>
    }>
  }>
}

function loadChampions(locale: string): ExportedChampion[] {
  const dir = join(dataRoot, currentVersion, locale, 'champions')
  return readdirSync(dir)
    .filter(file => file.endsWith('.json') && file !== 'index.json')
    .map(file => {
      const payload = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as {
        champion: ExportedChampion
      }
      return payload.champion
    })
}

function inRange(value: unknown, min: number, max: number): boolean {
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max
}

describe.each(LOCALES)(`exports champions ${currentVersion} — %s`, locale => {
  const champions = loadChampions(locale)

  it('couvre bien tout le roster', () => {
    expect(champions.length).toBeGreaterThanOrEqual(170)
  })

  it('stats de base dans les bornes du jeu', () => {
    const broken: string[] = []
    for (const champion of champions) {
      const base = champion.baseStats ?? {}
      const checks: Array<[string, boolean]> = [
        ['hp', inRange(base.hp, 300, 900)],
        ['hpRegen', inRange(base.hpRegen, 0, 15)],
        ['armor', inRange(base.armor, 10, 60)],
        ['magicResist', inRange(base.magicResist, 15, 50)],
        ['attackDamage', inRange(base.attackDamage, 35, 90)],
        ['attackSpeed', inRange(base.attackSpeed, 0.4, 1.0)],
        ['attackRange', inRange(base.attackRange, 100, 700)],
        ['movespeed', inRange(base.movespeed, 300, 400)],
        ['mp', inRange(base.mp, 0, 20000)],
        ['mpRegen', inRange(base.mpRegen, 0, 100)],
      ]
      for (const [field, ok] of checks) {
        if (!ok) broken.push(`${champion.id}.baseStats.${field} = ${base[field]}`)
      }
    }
    expect(broken, broken.join('\n')).toEqual([])
  })

  it('croissances par niveau dans les bornes du jeu (dont AD > 0, bug DDragon)', () => {
    const broken: string[] = []
    for (const champion of champions) {
      const growth = champion.growthStats ?? {}
      const adMin = ZERO_AD_GROWTH_WHITELIST.has(champion.id) ? 0 : 0.5
      const checks: Array<[string, boolean]> = [
        ['hp', inRange(growth.hp, 50, 160)],
        ['hpRegen', inRange(growth.hpRegen, 0, 2)],
        ['armor', inRange(growth.armor, 0, 8)],
        ['magicResist', inRange(growth.magicResist, 0, 4)],
        ['attackDamage', inRange(growth.attackDamage, adMin, 8)],
        ['attackSpeed', inRange(growth.attackSpeed, 0, 10)],
      ]
      for (const [field, ok] of checks) {
        if (!ok) broken.push(`${champion.id}.growthStats.${field} = ${growth[field]}`)
      }
    }
    expect(broken, broken.join('\n')).toEqual([])
  })

  it('4 sorts Q/W/E/R avec descriptions résolues (pas de tokens {{ }})', () => {
    const broken: string[] = []
    for (const champion of champions) {
      const slots = (champion.spells ?? []).map(s => s.slot)
      if (slots.join(',') !== 'Q,W,E,R') {
        broken.push(`${champion.id}: slots = ${slots.join(',')}`)
        continue
      }
      for (const spell of champion.spells) {
        const text = String(spell.descriptionText ?? '')
        if (!text.trim()) broken.push(`${champion.id} ${spell.slot}: description vide`)
        if (text.includes('{{')) broken.push(`${champion.id} ${spell.slot}: token non résolu`)
      }
      const passiveText = String(champion.passive?.descriptionText ?? '')
      if (passiveText.includes('{{')) broken.push(`${champion.id} P: token non résolu`)
    }
    expect(broken, broken.join('\n')).toEqual([])
  })

  it('pas de nouvelle anomalie de rendu dans les descriptions (%%, fractions sans %)', () => {
    if (locale !== 'fr_FR') return // audit sur la locale principale uniquement
    const broken: string[] = []
    for (const champion of champions) {
      const scopes: Array<{ label: string; text: Record<string, unknown> }> = [
        { label: 'P', text: (champion.passive ?? {}) as Record<string, unknown> },
        ...champion.spells.map(spell => ({
          label: spell.slot,
          text: spell as unknown as Record<string, unknown>,
        })),
      ]
      for (const { label, text } of scopes) {
        for (const field of ['descriptionText', 'detailedText'] as const) {
          const issues = auditDescriptionText(String(text[field] ?? ''))
          if (issues.length === 0) continue
          const key = `${champion.id}|${label}|${field}`
          if (KNOWN_TEXT_ANOMALIES.has(key)) continue
          broken.push(`${key}: ${issues.join(' ; ')}`)
        }
      }
    }
    expect(broken, broken.join('\n')).toEqual([])
  })

  it('ratios des sorts valides (stat connue, coefficients finis)', () => {
    const broken: string[] = []
    for (const champion of champions) {
      for (const spell of champion.spells ?? []) {
        for (const calc of spell.calculations ?? []) {
          for (const value of calc.baseValues ?? []) {
            if (!Number.isFinite(value)) {
              broken.push(`${champion.id} ${spell.slot} ${calc.key}: baseValue non fini`)
            }
          }
          for (const ratio of calc.ratios ?? []) {
            if (!ALLOWED_RATIO_STATS.has(ratio.stat)) {
              broken.push(`${champion.id} ${spell.slot} ${calc.key}: stat inconnue "${ratio.stat}"`)
            }
            if (
              !Array.isArray(ratio.coefficient) ||
              ratio.coefficient.length === 0 ||
              ratio.coefficient.some(c => !Number.isFinite(c))
            ) {
              broken.push(`${champion.id} ${spell.slot} ${calc.key}: coefficient invalide`)
            }
          }
        }
      }
    }
    expect(broken, broken.join('\n')).toEqual([])
  })
})
