import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// The harness build gate runs `npm run build -w frontend` while PM2 serves `.output`:
// rebuilding in place deletes live chunks (ENOENT / ERR_MODULE_NOT_FOUND → 500).
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

describe('frontend build scripts', () => {
  it('verification build writes outside the live .output', () => {
    expect(pkg.scripts.build).toContain('NUXT_OUTPUT_DIR=.output-verify')
    expect(pkg.scripts.build).toContain('NUXT_BUILD_DIR=.nuxt-verify')
  })

  it('deploy build (build:no-restart) still targets the live .output', () => {
    expect(pkg.scripts['build:no-restart']).not.toContain('NUXT_OUTPUT_DIR')
  })
})
