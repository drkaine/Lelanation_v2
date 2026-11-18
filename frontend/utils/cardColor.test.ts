import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f)
    if (statSync(join(root, p)).isDirectory()) files(p, out)
    else if (/\.(vue|css)$/.test(f)) out.push(p)
  }
  return out
}

describe('cards et tableaux : bleu de la nav/footer (chrome)', () => {
  it('panel et surface pointent sur chrome', () => {
    const tokens = read('assets/css/tokens.css')
    expect(tokens).toMatch(/--color-panel:\s*var\(--color-chrome\)/)
    expect(tokens).toMatch(/--rgb-panel:\s*var\(--rgb-chrome\)/)
    expect(tokens).toMatch(/--color-surface:\s*var\(--color-chrome\)/)
    expect(tokens).toMatch(/--rgb-surface:\s*var\(--rgb-chrome\)/)
  })

  it('les cartes build utilisent chrome', () => {
    const css = read('assets/css/ui-build-card.css')
    expect(css).not.toMatch(/linear-gradient\(var\(--color-blue-500\)/)
    expect(css).toMatch(/linear-gradient\(var\(--color-chrome\), var\(--color-chrome\)\)/)
  })

  it('BuildCard (recto, verso) en chrome', () => {
    for (const p of [
      'components/Build/BuildCard.vue',
      '../packages/builds-ui/src/components/BuildCardFlip.vue',
    ]) {
      const src = read(p)
      expect(src).not.toMatch(/linear-gradient\(var\(--color-blue-500\)/)
      expect(src).not.toMatch(/gradient-primary-mirror/)
      expect(src).not.toMatch(/rgba\(10, 20, 40/)
    }
  })

  it('boutons : fond des cards (chrome)', () => {
    const css = read('assets/css/ui-build-card.css')
    expect(css).toMatch(/\.ui-build-card-action-button \{[^}]*background: var\(--color-chrome\)/)
    const tags = ['components', 'pages']
      .flatMap(d => files(d))
      .filter(p => p.endsWith('.vue'))
      .flatMap(p => (read(p).match(/<(button|NuxtLink)\b[^>]*>/g) ?? []).map(t => `${p}: ${t}`))
      .filter(t => /(^|[\s'"])bg-(background|black\/20)\b/.test(t))
    expect(tags).toEqual([])
  })

  it('statistics : bordure 1px, or plus sombre', () => {
    const css = read('assets/css/ui-statistics.css')
    expect(css).toMatch(/\.statistics \{\s*--card-border-width: 1px;/)
    expect(css).toMatch(
      /\.statistics :is\(\.ui-build-card-surface, \.ui-build-card-button\)[^{]*\{[^}]*--card-border-gradient-strong: var\(--card-border-gradient-dark\)/
    )
    expect(read('assets/css/ui-build-card.css')).toMatch(
      /border: var\(--card-border-width, 2px\) solid transparent/
    )
    expect(read('assets/css/tokens.css')).toMatch(/--card-border-gradient-dark:/)
    expect(read('assets/css/stats-head.css')).not.toMatch(/#785a28/)
  })

  it('fond du body plus clair que blue-500', () => {
    const tokens = read('assets/css/tokens.css')
    expect(tokens).toMatch(/--color-page: #0e1b33;/)
    expect(tokens).toMatch(/html \{\s*background: var\(--color-page\);/)
    expect(tokens).toMatch(/body \{\s*background: var\(--color-page\);/)
    expect(tokens).toMatch(/--rgb-background: 14 27 51;/)
  })

  it('boutons (CSS) : pas de fond neutre translucide, chrome à la place', () => {
    const NEUTRAL =
      /background(?:-color)?\s*:\s*(rgb\(var\(--rgb-(background|surface)\)\s*\/|rgba\(10, 20, 40,|rgba\(0, 0, 0, 0\.2|rgb\(30 35 40 \/)/
    const hits: string[] = []
    for (const p of ['components', 'pages', '../packages/builds-ui/src'].flatMap(d => files(d))) {
      let css = read(p)
      if (p.endsWith('.vue'))
        css = [...css.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n')
      for (const [, sel, body] of css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
        if (
          !/btn|button|toggle/i.test(sel!) ||
          /:hover|active|selected|:focus|disabled|checked|track|thumb/.test(sel!)
        )
          continue
        if (NEUTRAL.test(body!)) hits.push(`${p} ${sel!.trim()}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('boutons (Tailwind) : pas de bg-surface/xx ni panel-elevated/xx', () => {
    const tags = ['components', 'pages']
      .flatMap(d => files(d))
      .filter(p => p.endsWith('.vue'))
      .flatMap(p => (read(p).match(/<(button|NuxtLink)\b[^>]*>/g) ?? []).map(t => `${p}: ${t}`))
      .filter(t => /(^|[\s'"])bg-(surface|panel-elevated)\/\d+/.test(t))
    expect(tags).toEqual([])
  })

  it('plus de #0a1428 en dur dans les composants', () => {
    const hits = ['components', 'pages', 'assets/css']
      .flatMap(d => files(d))
      .filter(p => !p.endsWith('tokens.css'))
      .filter(p => /#0a1428/i.test(read(p)))
    expect(hits).toEqual([])
  })
})

describe('stats : ombrage des cartes et tableaux', () => {
  const css = read('assets/css/ui-statistics.css')
  it('token d’ombre dédié', () => {
    expect(read('assets/css/tokens.css')).toMatch(/--shadow-stats-card:\s*[^;]*rgb\(0 0 0/)
  })
  it.each([
    'statistics',
    'champion-stats',
    'lelariva-stats',
    'statistics-surveillance',
    'statistics-custom',
    'item-stats',
  ])('page %s : cartes ombrées', scope => {
    const rule = css.match(/([^{}]*)\{\s*box-shadow:\s*var\(--shadow-stats-card\)/)
    expect(rule?.[1]).toContain(`.${scope}`)
    for (const card of [
      'ui-build-card-surface',
      'ov-card',
      'hd-card',
      'team-card',
      'vi-dtable-wrap',
    ])
      expect(rule?.[1]).toContain(`.${card}`)
  })
})
