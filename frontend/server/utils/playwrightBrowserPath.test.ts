import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { findInstalledChromiumExecutable } from './playwrightBrowserPath'

function touch(root: string, ...parts: string[]): string {
  const file = join(root, ...parts)
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, '')
  return file
}

describe('findInstalledChromiumExecutable', () => {
  it('returns null when no browser is installed', () => {
    const root = mkdtempSync(join(tmpdir(), 'pw-'))
    expect(findInstalledChromiumExecutable([root])).toBeNull()
    expect(findInstalledChromiumExecutable([join(root, 'missing')])).toBeNull()
  })

  it('finds a headless shell of another revision than the one playwright expects', () => {
    const root = mkdtempSync(join(tmpdir(), 'pw-'))
    const shell = touch(
      root,
      'chromium_headless_shell-1248',
      'chrome-headless-shell-linux64',
      'chrome-headless-shell'
    )
    expect(findInstalledChromiumExecutable([root])).toBe(shell)
  })

  it('prefers the newest revision, headless shell before full chromium', () => {
    const root = mkdtempSync(join(tmpdir(), 'pw-'))
    touch(root, 'chromium-1300', 'chrome-linux64', 'chrome')
    touch(
      root,
      'chromium_headless_shell-1200',
      'chrome-headless-shell-linux64',
      'chrome-headless-shell'
    )
    const newest = touch(
      root,
      'chromium_headless_shell-1248',
      'chrome-headless-shell-linux64',
      'chrome-headless-shell'
    )
    expect(findInstalledChromiumExecutable([root])).toBe(newest)
  })

  it('falls back to the full chromium build', () => {
    const root = mkdtempSync(join(tmpdir(), 'pw-'))
    const chrome = touch(root, 'chromium-1248', 'chrome-linux64', 'chrome')
    expect(findInstalledChromiumExecutable(['', root])).toBe(chrome)
  })
})
