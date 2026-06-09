/**
 * Main patch scraper entry point
 * Called by cron job to scrape patch notes
 */

import { logger } from '../utils/logger.js';
import { fetchPage, fetchBinary, delayBetweenRequests } from './fetcher.js';
import {
  parsePatchHtml,
  extractSummaryImageUrl,
  buildSummaryImageFilename,
} from './parser.js';
import { cleanChanges, deduplicateEntities, mergeEntityVariants, sortEntities } from './cleaner.js';
import { enrichEntityIds } from './entityIds.js';
import { loadGameDataIndexes } from './gameDataLoader.js';
import {
  writePatchJson,
  writePatchImage,
  getPatchVersionDir,
  buildPatchNotesPublicPath,
} from '../utils/fileWriter.js';
import { extractPatchVersion, getFrUrl, isValidPatchUrl, notesUrlVersionToPatchLabel } from '../utils/helpers.js';
import { assertPatchReadyToScrape } from './patchPreflight.js';
import { notifyPatchScrapeFailure } from './patchScrapeAlerts.js';
import { persistPatchNotesStats } from '../services/PatchNotesStatsService.js';
import type { PatchJson, Locale, PatchSummaryImage, EntityChanges } from './types.js';

// Delay between EN and FR requests (ms)
const REQUEST_DELAY_MS = 2000;

/**
 * Scrape patch notes from both EN and FR URLs
 * Main entry point called by cron
 */
export async function scrapePatch(
  enUrl: string,
  outputDir: string,
  storageVersion?: string,
  options?: { skipPreflight?: boolean; triggeredBy?: string }
): Promise<void> {
  logger.info({ enUrl, outputDir, storageVersion }, 'Starting patch scrape');

  const patchVersion = storageVersion ?? notesUrlVersionToPatchLabel(extractPatchVersion(enUrl));
  const alertContext = {
    patchVersion,
    url: enUrl,
    triggeredBy: options?.triggeredBy,
  };

  try {
    if (!isValidPatchUrl(enUrl)) {
      throw new Error(`Invalid patch URL: ${enUrl}`);
    }

    if (!options?.skipPreflight) {
      const entityCount = await assertPatchReadyToScrape(enUrl);
      logger.info({ enUrl, entityCount }, 'Patch preflight check passed');
    }

    const frUrl = getFrUrl(enUrl);
    logger.info({ patchVersion, frUrl }, 'Resolved URLs');

    await scrapeLocale(enUrl, 'en-GB', patchVersion, outputDir);
    await delayBetweenRequests(REQUEST_DELAY_MS);
    await scrapeLocale(frUrl, 'fr-FR', patchVersion, outputDir);

    logger.info({ patchVersion }, 'Patch scrape complete');
  } catch (error) {
    await notifyPatchScrapeFailure(error, alertContext);
    throw error;
  }
}

/**
 * Scrape a single locale version
 */
async function scrapeLocale(
  url: string,
  locale: Locale,
  patchVersion: string,
  outputDir: string
): Promise<void> {
  logger.info({ url, locale }, 'Scraping locale');

  try {
    const html = await fetchPage(url);
    const rawEntities = parsePatchHtml(html, locale);

    let cleanedEntities = cleanChanges(rawEntities);
    cleanedEntities = mergeEntityVariants(cleanedEntities);
    cleanedEntities = await enrichEntitiesWithGameData(cleanedEntities);
    cleanedEntities = deduplicateEntities(cleanedEntities);
    cleanedEntities = sortEntities(cleanedEntities);

    if (cleanedEntities.length === 0) {
      throw new Error(`Aucune entité extraite après nettoyage (${locale})`);
    }

    const summaryImage = await downloadSummaryImage(html, patchVersion, locale, outputDir);

    const patchJson: PatchJson = {
      patchVersion,
      locale,
      scrapedAt: new Date().toISOString(),
      url,
      summaryImage,
      entities: cleanedEntities,
    };

    const versionDir = getPatchVersionDir(outputDir, patchVersion);
    const filename = `patch-${patchVersion}-${locale}.json`;
    await writePatchJson(versionDir, filename, patchJson);

    if (locale === 'en-GB') {
      try {
        await persistPatchNotesStats(patchJson);
      } catch (statsError) {
        logger.warn(
          { patchVersion, locale, error: statsError },
          'patch_notes_stats persistence failed (scrape continues)'
        );
      }
    }

    logger.info(
      {
        locale,
        entities: cleanedEntities.length,
        changes: cleanedEntities.reduce((s, e) => s + e.changes.length, 0),
      },
      'Locale scrape complete'
    );
  } catch (error) {
    logger.error({ url, locale, error }, 'Failed to scrape locale');
    throw error;
  }
}

/**
 * Scrape both locales with full result
 * Use this when you need the parsed data returned instead of just written to disk
 */
export async function scrapePatchWithResult(
  enUrl: string,
  outputDir: string
): Promise<{ en: PatchJson | null; fr: PatchJson | null }> {
  logger.info({ enUrl, outputDir }, 'Starting patch scrape with result');

  if (!isValidPatchUrl(enUrl)) {
    throw new Error(`Invalid patch URL: ${enUrl}`);
  }

  const patchVersion = extractPatchVersion(enUrl);
  const frUrl = getFrUrl(enUrl);

  const results: { en: PatchJson | null; fr: PatchJson | null } = {
    en: null,
    fr: null,
  };

  // EN
  try {
    results.en = await scrapeLocaleWithResult(enUrl, 'en-GB', patchVersion, outputDir);
    const versionDir = getPatchVersionDir(outputDir, patchVersion);
    const filename = `patch-${patchVersion}-en-GB.json`;
    await writePatchJson(versionDir, filename, results.en);
  } catch (error) {
    logger.error({ url: enUrl, error }, 'Failed to scrape EN');
  }

  await delayBetweenRequests(REQUEST_DELAY_MS);

  // FR
  try {
    results.fr = await scrapeLocaleWithResult(frUrl, 'fr-FR', patchVersion, outputDir);
    const versionDir = getPatchVersionDir(outputDir, patchVersion);
    const filename = `patch-${patchVersion}-fr-FR.json`;
    await writePatchJson(versionDir, filename, results.fr);
  } catch (error) {
    logger.error({ url: frUrl, error }, 'Failed to scrape FR');
  }

  return results;
}

/**
 * Scrape single locale and return data
 */
async function scrapeLocaleWithResult(
  url: string,
  locale: Locale,
  patchVersion: string,
  outputDir: string
): Promise<PatchJson> {
  const html = await fetchPage(url);
  const rawEntities = parsePatchHtml(html, locale);
  let cleanedEntities = cleanChanges(rawEntities);
  cleanedEntities = mergeEntityVariants(cleanedEntities);
  cleanedEntities = await enrichEntitiesWithGameData(cleanedEntities);
  cleanedEntities = deduplicateEntities(cleanedEntities);
  cleanedEntities = sortEntities(cleanedEntities);
  const summaryImage = await downloadSummaryImage(html, patchVersion, locale, outputDir);

  return {
    patchVersion,
    locale,
    scrapedAt: new Date().toISOString(),
    url,
    summaryImage,
    entities: cleanedEntities,
  };
}

async function enrichEntitiesWithGameData(entities: EntityChanges[]): Promise<EntityChanges[]> {
  const indexes = await loadGameDataIndexes();
  if (!indexes) {
    return entities;
  }
  return enrichEntityIds(entities, indexes);
}

/**
 * Extract and download the patch summary infographic
 */
async function downloadSummaryImage(
  html: string,
  patchVersion: string,
  locale: Locale,
  outputDir: string
): Promise<PatchSummaryImage | undefined> {
  const extracted = extractSummaryImageUrl(html);
  if (!extracted) {
    logger.warn({ patchVersion, locale }, 'No summary image to download');
    return undefined;
  }

  try {
    const versionDir = getPatchVersionDir(outputDir, patchVersion);
    const imageBuffer = await fetchBinary(extracted.url);
    const filename = buildSummaryImageFilename(patchVersion, locale, extracted.url);
    await writePatchImage(versionDir, filename, imageBuffer);
    const localPath = buildPatchNotesPublicPath(patchVersion, filename);

    logger.info({ patchVersion, locale, url: extracted.url, localPath }, 'Summary image downloaded');

    return {
      url: extracted.url,
      localPath,
      width: extracted.width,
      height: extracted.height,
    };
  } catch (error) {
    logger.error({ patchVersion, locale, url: extracted.url, error }, 'Failed to download summary image');
    return {
      url: extracted.url,
      localPath: '',
      width: extracted.width,
      height: extracted.height,
    };
  }
}
