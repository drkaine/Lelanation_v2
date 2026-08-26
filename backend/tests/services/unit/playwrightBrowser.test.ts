import { describe, expect, it } from 'vitest'
import {
  hasInstalledChromium,
  isMissingBrowserExecutableError,
  resolvePlaywrightBrowsersPath,
} from '../../../src/utils/playwrightBrowser.js'

describe('playwrightBrowser helpers', () => {
  it('detects missing browser executable errors', () => {
    expect(
      isMissingBrowserExecutableError(
        new Error(
          "browserType.launch: Executable doesn't exist at /tmp/playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell"
        )
      )
    ).toBe(true)
    expect(isMissingBrowserExecutableError(new Error('timeout'))).toBe(false)
  })

  it('prefers home cache when sandbox temp path has no browsers', () => {
    const previous = process.env.PLAYWRIGHT_BROWSERS_PATH
    process.env.PLAYWRIGHT_BROWSERS_PATH =
      '/tmp/cursor-sandbox-cache/abc/playwright/chromium_headless_shell-1228'
    try {
      const resolved = resolvePlaywrightBrowsersPath()
      expect(resolved.endsWith('.cache/ms-playwright')).toBe(true)
      expect(hasInstalledChromium('/tmp/definitely-missing-playwright-cache')).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH
      else process.env.PLAYWRIGHT_BROWSERS_PATH = previous
    }
  })
})
