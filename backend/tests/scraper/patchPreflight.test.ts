import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  runPatchPreflight,
  validatePatchHtmlContent,
  PatchPreflightError,
  assertPatchReadyToScrape,
} from '../../src/scraper/patchPreflight.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

describe('patchPreflight', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('validatePatchHtmlContent', () => {
    it('should accept valid patch notes HTML', () => {
      const html = loadFixture('riot-live-structure.html');
      const count = validatePatchHtmlContent(html, 'fr-FR');
      expect(count).toBeGreaterThan(0);
    });

    it('should reject HTML without patch structure', () => {
      expect(() => validatePatchHtmlContent('<html><body>Hello</body></html>', 'en-GB')).toThrow(
        PatchPreflightError
      );
    });
  });

  describe('runPatchPreflight', () => {
    it('should fail with url_not_found on HTTP 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
        text: async () => '<html>Not found</html>',
      }) as unknown as typeof fetch;

      const result = await runPatchPreflight('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-99-99-notes/');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('url_not_found');
        expect(result.status).toBe(404);
      }
    });

    it('should fail with http_error on other HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 503,
        text: async () => '<html>Service unavailable</html>',
      }) as unknown as typeof fetch;

      const result = await runPatchPreflight('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-26-11-notes/');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('http_error');
        expect(result.status).toBe(503);
      }
    });

    it('should fail with fetch_failed on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

      const result = await runPatchPreflight('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-26-11-notes/');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('fetch_failed');
      }
    });

    it('should pass when page is valid patch notes', async () => {
      const html = loadFixture('riot-live-structure.html');
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: async () => html,
      }) as unknown as typeof fetch;

      const result = await runPatchPreflight('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-26-11-notes/');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.entityCount).toBeGreaterThan(0);
        expect(result.status).toBe(200);
      }
    });
  });

  describe('assertPatchReadyToScrape', () => {
    it('should throw PatchPreflightError on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 404,
        text: async () => '<html>404</html>',
      }) as unknown as typeof fetch;

      await expect(
        assertPatchReadyToScrape('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-99-99-notes/')
      ).rejects.toMatchObject({
        reason: 'url_not_found',
        status: 404,
      });
    });
  });
});
