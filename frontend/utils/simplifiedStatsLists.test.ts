import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const appVue = readFileSync(join(root, 'app.vue'), 'utf8')
const tabsDir = join(root, 'components/statistics/tabs')

/** Classes de liste affichées de force en mode stats simplifié (Alt+C), y compris en desktop. */
function forcedListClasses(): Set<string> {
  const block = appVue.match(
    /@media \(min-width: 768px\)\s*\{\s*html\[data-stats-cards='1'\] \{[^}]*\}\s*html\[data-stats-cards='1'\]\s*:is\(([^)]*)\)\s*\{\s*display: flex !important/
  )
  expect(block, 'règle desktop des listes simplifiées introuvable').toBeTruthy()
  return new Set(block![1]!.split(',').map(s => s.trim().replace(/^\./, '')))
}

describe('stats simplifiées : les listes cartes des onglets sont affichées', () => {
  const forced = forcedListClasses()
  const tabs = readdirSync(tabsDir).filter(f => f.endsWith('.vue'))

  for (const file of tabs) {
    const src = readFileSync(join(tabsDir, file), 'utf8')
    // Liste mobile masquée en desktop (`md:hidden`) dont la table desktop est masquée en mode simplifié.
    const lists = [...src.matchAll(/class="([^"]*\b[a-z]+-mlist\b[^"]*\bmd:hidden\b[^"]*)"/g)]
    for (const [, cls] of lists) {
      it(`${file} : « ${cls} » porte une classe forcée`, () => {
        expect(cls!.split(/\s+/).some(c => forced.has(c))).toBe(true)
      })
    }
  }
})
