import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { chromium, type Browser, type LaunchOptions } from 'playwright'

const runtimeRequire = createRequire(import.meta.url)

function chromiumExecutableCandidates(browsersPath: string, dirName: string): string[] {
  const base = join(browsersPath, dirName)
  return [
    join(base, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
    join(base, 'chrome-linux64', 'chrome'),
    join(base, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    join(base, 'chrome-win', 'chrome.exe'),
  ]
}

export function hasInstalledChromium(browsersPath: string): boolean {
  if (!browsersPath || !existsSync(browsersPath)) return false
  try {
    for (const name of readdirSync(browsersPath)) {
      if (!name.startsWith('chromium')) continue
      if (chromiumExecutableCandidates(browsersPath, name).some(path => existsSync(path))) {
        return true
      }
    }
  } catch {
    return false
  }
  return false
}

/** Prefer a durable cache path over ephemeral sandbox temp dirs without browsers. */
export function resolvePlaywrightBrowsersPath(): string {
  const envPath = (process.env.PLAYWRIGHT_BROWSERS_PATH || '').trim()
  const homeCache = join(homedir(), '.cache/ms-playwright')
  const candidates = [envPath, homeCache].filter(Boolean)

  for (const candidate of candidates) {
    if (hasInstalledChromium(candidate)) {
      return candidate
    }
  }

  if (envPath && (envPath.startsWith('/tmp/') || envPath.includes('cursor-sandbox-cache'))) {
    return homeCache
  }

  return envPath || homeCache
}

export function ensurePlaywrightBrowsersPath(): string {
  const resolved = resolvePlaywrightBrowsersPath()
  process.env.PLAYWRIGHT_BROWSERS_PATH = resolved
  return resolved
}

export function isMissingBrowserExecutableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("Executable doesn't exist") ||
    message.includes('browserType.launch') ||
    message.includes('Please run the following command to download new browsers')
  )
}

function resolvePlaywrightCliPath(): string {
  const pkgPath = runtimeRequire.resolve('playwright/package.json')
  return join(dirname(pkgPath), 'cli.js')
}

export async function installPlaywrightChromium(browsersPath: string): Promise<void> {
  const cliPath = resolvePlaywrightCliPath()
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, 'install', 'chromium'], {
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    child.stderr?.on('data', chunk => {
      stderr += String(chunk)
    })

    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `playwright install chromium exited with code ${code}`))
    })
  })
}

export type LaunchChromiumOptions = LaunchOptions & {
  onInstall?: (reason: string) => void | Promise<void>
}

/**
 * Launch Chromium with a durable browsers cache and auto-install + retry when binaries are missing.
 */
export async function launchChromium(options: LaunchChromiumOptions = {}): Promise<Browser> {
  const { onInstall, ...launchOptions } = options
  const launchOpts: LaunchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...launchOptions,
  }

  let browsersPath = ensurePlaywrightBrowsersPath()

  if (!hasInstalledChromium(browsersPath)) {
    await onInstall?.('Chromium binaire absent — installation Playwright')
    await installPlaywrightChromium(browsersPath)
    browsersPath = ensurePlaywrightBrowsersPath()
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await chromium.launch(launchOpts)
    } catch (error) {
      if (attempt === 0 && isMissingBrowserExecutableError(error)) {
        await onInstall?.(
          error instanceof Error ? error.message : 'Chromium introuvable — réinstallation Playwright'
        )
        await installPlaywrightChromium(browsersPath)
        browsersPath = ensurePlaywrightBrowsersPath()
        continue
      }
      throw error
    }
  }

  throw new Error('Failed to launch Chromium after Playwright install retry')
}
