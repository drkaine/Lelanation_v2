import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** `.vue` files under `dir`, recursively. */
function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? vueFiles(path) : path.endsWith('.vue') ? [path] : []
  })
}

describe('tailwind class typos', () => {
  it('has no `border-p.t` left from a broken `t` → `p.t` rename', () => {
    const root = join(__dirname, '..')
    const offenders = ['components', 'pages']
      .flatMap(dir => vueFiles(join(root, dir)))
      .filter(file => /border-p\.t\b/.test(readFileSync(file, 'utf-8')))
      .map(file => file.slice(root.length + 1))
    expect(offenders).toEqual([])
  })
})
