import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string): string => readFileSync(resolve(__dirname, '..', p), 'utf8')

/** Sous-menus qui doivent reprendre le visuel des onglets de Statistiques (soulignement doré). */
const SUBMENUS = [
  'components/statistics/pages/StatisticsIndexPage.vue',
  'pages/statistics/tier-list.vue',
  'pages/statistics/meta-chart.vue',
  'components/Build/BuildMenuSteps.vue',
  'components/Build/BuildDetailsPage.vue',
  'components/matchups/MatchupSheetsIndexPageView.vue',
  'pages/equipe.vue',
  '../packages/builds-ui/src/components/BuildsIndexPageView.vue',
]

describe('sous-nav partagée', () => {
  it('est définie globalement avec le style des onglets Statistiques', () => {
    const css = read('assets/css/subnav.css')
    expect(css).toMatch(/\.subnav-link\.is-active\s*{[^}]*border-bottom-color/)
    expect(read('app.vue')).toContain("@import './assets/css/subnav.css'")
  })

  it.each(SUBMENUS)('%s utilise .subnav / .subnav-link', file => {
    const src = read(file)
    expect(src).toMatch(/class="[^"]*\bsubnav\b/)
    expect(src).toMatch(/subnav-link/)
    expect(src).not.toMatch(/stats-subtab\b|streamer-tab-button|matchup-sheets-tab-button/)
  })
})

describe('/equipe : visuel du site, pleine largeur', () => {
  it('en-tête du site et pas de conteneur étroit', () => {
    const src = read('pages/equipe.vue')
    expect(src).toMatch(/class="[^"]*\bteam-head\b/)
    expect(src).toMatch(/class="[^"]*\bteam-h1\b/)
    expect(src).not.toMatch(/max-w-(4xl|5xl|6xl)/)
  })
})
