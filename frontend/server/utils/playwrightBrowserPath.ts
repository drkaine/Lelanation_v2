import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LAYOUTS: Array<{ prefix: string; exe: string[] }> = [
  {
    prefix: 'chromium_headless_shell-',
    exe: ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
  },
  { prefix: 'chromium-', exe: ['chrome-linux64', 'chrome'] },
]

/**
 * Chromium déjà installé dans un cache Playwright, quelle que soit sa révision.
 * Repli quand la révision attendue par le paquet `playwright` manque (navigateurs mis à jour
 * par une autre version de Playwright) : headless shell d'abord, révision la plus récente.
 */
export function findInstalledChromiumExecutable(roots: string[]): string | null {
  for (const { prefix, exe } of LAYOUTS) {
    let best: { revision: number; path: string } | null = null
    for (const root of roots) {
      if (!root || !existsSync(root)) continue
      for (const entry of readdirSync(root)) {
        if (!entry.startsWith(prefix)) continue
        const revision = Number(entry.slice(prefix.length))
        if (!Number.isFinite(revision)) continue
        const path = join(root, entry, ...exe)
        if (existsSync(path) && (!best || revision > best.revision)) best = { revision, path }
      }
    }
    if (best) return best.path
  }
  return null
}
