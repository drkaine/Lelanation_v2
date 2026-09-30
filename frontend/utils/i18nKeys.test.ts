import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const SOURCE_DIRS = [
  'app.vue',
  'components',
  'composables',
  'constants',
  'layouts',
  'pages',
  'plugins',
  'stores',
  'utils',
]

/** `.vue`/`.ts` source files (tests excluded) under `path`, recursively. */
function sourceFiles(path: string): string[] {
  let stat
  try {
    stat = statSync(path)
  } catch {
    return []
  }
  if (!stat.isDirectory())
    return /\.(vue|ts)$/.test(path) && !path.endsWith('.test.ts') ? [path] : []
  return readdirSync(path).flatMap(name => sourceFiles(join(path, name)))
}

/** Leaf keys of a nested messages object, dot-joined. */
function leafKeys(messages: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object'
      ? leafKeys(value as Record<string, unknown>, full)
      : [full]
  })
}

const locale = (lang: string) =>
  leafKeys(JSON.parse(readFileSync(join(root, 'i18n/locales', `${lang}.json`), 'utf8')))

/** Literal keys passed to `t('…')` / `$t('…')` (concatenated or templated keys are skipped). */
function calledKeys(): Map<string, string> {
  const calls = new Map<string, string>()
  for (const file of SOURCE_DIRS.flatMap(dir => sourceFiles(join(root, dir)))) {
    const src = readFileSync(file, 'utf8')
    for (const [, , key] of src.matchAll(/\$?\bt\(\s*(['"])([\w.-]+)\1\s*[,)]/g)) {
      if (key && !calls.has(key)) calls.set(key, file.slice(root.length + 1))
    }
  }
  return calls
}

describe('i18n keys', () => {
  const fr = locale('fr')
  const en = locale('en')

  it('fr and en define the same keys', () => {
    expect(fr.filter(key => !en.includes(key))).toEqual([])
    expect(en.filter(key => !fr.includes(key))).toEqual([])
  })

  it('every literal t() key exists in fr and en', () => {
    const defined = new Set(fr.filter(key => en.includes(key)))
    const missing = [...calledKeys()]
      .filter(([key]) => !defined.has(key))
      .map(([key, file]) => `${key} (${file})`)
    expect(missing).toEqual([])
  })
})
