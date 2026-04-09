import type { Browser } from 'playwright'

let browserPromise: Promise<Browser> | null = null

function createBrowserPromise(): Promise<Browser> {
  return (async () => {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    browser.on('disconnected', () => {
      browserPromise = null
    })
    return browser
  })()
}

async function getSharedBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = createBrowserPromise()
  }
  try {
    return await browserPromise
  } catch (error) {
    // If launch failed once, don't keep a rejected promise forever.
    browserPromise = null
    throw error
  }
}

async function resetSharedBrowser(): Promise<void> {
  if (!browserPromise) return
  try {
    const browser = await browserPromise
    await browser.close()
  } catch {
    // Ignore close errors; we'll recreate on next request.
  } finally {
    browserPromise = null
  }
}

export type ScreenshotBuildCardOptions = {
  /** URL complète de la page Nuxt /render/build-card (avec query). */
  pageUrl: string
  timeoutMs?: number
}

/**
 * Capture l’élément `[data-build-card-screenshot-root]` après chargement réseau.
 */
export async function screenshotBuildCardPng(opts: ScreenshotBuildCardOptions): Promise<Buffer> {
  const timeout = opts.timeoutMs ?? 90_000
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const browser = await getSharedBrowser()
      const context = await browser.newContext({
        viewport: { width: 1280, height: 2000 },
        deviceScaleFactor: 2,
      })
      const page = await context.newPage()
      try {
        await page.goto(opts.pageUrl, { waitUntil: 'networkidle', timeout })
        await page.waitForSelector('[data-build-card-screenshot-root]', { timeout: 30_000 })
        try {
          await page.waitForFunction(
            () => {
              const doc = (globalThis as { document?: any }).document
              const root = doc?.querySelector('[data-build-card-screenshot-root]')
              if (!root) return false
              const imgs = [...root.querySelectorAll('img')]
              if (imgs.length === 0) return true
              return imgs.every(i => i.complete)
            },
            { timeout: 35_000 }
          )
        } catch {
          // fallback si une image reste en attente
        }
        await new Promise(resolve => setTimeout(resolve, 500))
        const el = page.locator('[data-build-card-screenshot-root]').first()
        const buf = await el.screenshot({ type: 'png' })
        return buf as Buffer
      } finally {
        await context.close()
      }
    } catch (error) {
      lastError = error
      await resetSharedBrowser()
      if (attempt === 0) continue
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Screenshot failed')
}
