import type { Browser } from 'playwright'

let browserPromise: Promise<Browser> | null = null

async function getSharedBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const { chromium } = await import('playwright')
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  }
  return browserPromise
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
          const root = document.querySelector('[data-build-card-screenshot-root]')
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
}
