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

  it('plus de #0a1428 en dur dans les composants', () => {
    const hits = ['components', 'pages', 'assets/css']
      .flatMap(d => files(d))
      .filter(p => !p.endsWith('tokens.css'))
      .filter(p => /#0a1428/i.test(read(p)))
    expect(hits).toEqual([])
  })
})
