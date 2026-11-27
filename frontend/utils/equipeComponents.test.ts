import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')

/** Nom Nuxt d'un composant de components/Admin : le préfixe « Admin » n'est pas doublé. */
function nuxtAdminNames(): Set<string> {
  return new Set(
    readdirSync(join(root, 'components/Admin'))
      .filter(f => f.endsWith('.vue'))
      .map(f => f.slice(0, -4))
      .map(base => (base.startsWith('Admin') ? base : `Admin${base}`))
  )
}

describe('pages/equipe.vue', () => {
  it('chaque balise <Admin…> correspond à un composant Nuxt existant', () => {
    const page = readFileSync(join(root, 'pages/equipe.vue'), 'utf8')
    const tags = [...page.matchAll(/<(Admin[A-Za-z]+)/g)].map(m => m[1] ?? '')
    expect(tags.length).toBeGreaterThan(0)
    const names = nuxtAdminNames()
    for (const tag of tags) expect(names.has(tag), tag).toBe(true)
  })
})
