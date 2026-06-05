/**
 * Patch notes scraper integration — triggered by Data Dragon cron on new version.
 * Scrapes to backend/data/patches only; transfer to frontend happens in copyAllAssetsToFrontend.
 */

import { join } from 'path';
import { scrapePatch } from '../scraper/patchScraper.js';
import { buildPatchNotesUrl } from '../utils/helpers.js';
import { patchFileExists } from '../utils/fileWriter.js';
import { normalizeGamePatchKey } from './VersionService.js';
import { createCronLogger } from '../utils/cronLogger.js';
import { appendUnifiedLog } from '../logging/unifiedAppLog.js';

export type PatchScrapeResult =
  | { ok: true; scraped: true; patchVersion: string; url: string; outputDir: string }
  | { ok: true; scraped: false; patchVersion: string; reason: 'already_scraped' | 'invalid_version' }
  | { ok: false; patchVersion: string; error: string };

function getPatchOutputDir(): string {
  const fromEnv = process.env.PATCH_OUTPUT_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), 'data', 'patches');
}

async function isPatchAlreadyScraped(patchVersion: string, outputDir: string): Promise<boolean> {
  const [enExists, frExists] = await Promise.all([
    patchFileExists(outputDir, patchVersion, 'en-GB'),
    patchFileExists(outputDir, patchVersion, 'fr-FR'),
  ]);
  return enExists && frExists;
}

/**
 * Scrape patch notes for a game version if not already on disk (backend only).
 */
export async function scrapePatchNotesIfNeeded(
  gameVersion: string,
  cronName: string = 'patchNotesScraper'
): Promise<PatchScrapeResult> {
  const log = createCronLogger(cronName);
  const patchVersion = normalizeGamePatchKey(gameVersion);
  const outputDir = getPatchOutputDir();

  if (!patchVersion) {
    await log.warn('Invalid game version for patch scrape', { gameVersion });
    return { ok: true, scraped: false, patchVersion: gameVersion, reason: 'invalid_version' };
  }

  if (await isPatchAlreadyScraped(patchVersion, outputDir)) {
    await log.info('Patch notes already scraped in backend, skipping', { patchVersion, outputDir });
    return { ok: true, scraped: false, patchVersion, reason: 'already_scraped' };
  }

  const url = buildPatchNotesUrl(patchVersion);

  await log.info('Scraping patch notes for new version', { patchVersion, url, outputDir });
  await appendUnifiedLog({
    section: 'back',
    type: 'debut',
    script: 'patch_scraper',
    message: `Patch notes scrape démarré — v${patchVersion}`,
    json: { patchVersion, url, outputDir, triggeredBy: cronName },
  });

  try {
    await scrapePatch(url, outputDir);

    await log.info('Patch notes scraped successfully (backend)', { patchVersion, url, outputDir });
    await appendUnifiedLog({
      section: 'back',
      type: 'fin',
      script: 'patch_scraper',
      message: `Patch notes scrape terminé — v${patchVersion}`,
      json: { patchVersion, url, outputDir, triggeredBy: cronName },
    });

    return { ok: true, scraped: true, patchVersion, url, outputDir };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await log.error('Patch notes scrape failed', { patchVersion, url, error: errorMessage });
    await appendUnifiedLog({
      section: 'back',
      type: 'erreur',
      script: 'patch_scraper',
      message: `Patch notes scrape échoué — v${patchVersion}: ${errorMessage}`,
      json: { patchVersion, url, outputDir, triggeredBy: cronName, error: errorMessage },
    });
    return { ok: false, patchVersion, error: errorMessage };
  }
}
