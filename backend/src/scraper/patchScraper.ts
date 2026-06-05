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
import { cleanChanges, deduplicateEntities, sortEntities } from './cleaner.js';
import { enrichEntityIds } from './entityIds.js';
import { loadGameDataIndexes } from './gameDataLoader.js';
import { writePatchJson, writePatchImage } from '../utils/fileWriter.js';
import { extractPatchVersion, getFrUrl, isValidPatchUrl } from '../utils/helpers.js';
import type { PatchJson, Locale, PatchSummaryImage, EntityChanges } from './types.js';

// Delay between EN and FR requests (ms)
const REQUEST_DELAY_MS = 2000;

/**
 * Scrape patch notes from both EN and FR URLs
 * Main entry point called by cron
 */
export async function scrapePatch(enUrl: string, outputDir: string): Promise<void> {
  logger.info({ enUrl, outputDir }, 'Starting patch scrape');

  // Validate URL
  if (!isValidPatchUrl(enUrl)) {
    throw new Error(`Invalid patch URL: ${enUrl}`);
  }

  const patchVersion = extractPatchVersion(enUrl);
  const frUrl = getFrUrl(enUrl);

  logger.info({ patchVersion, frUrl }, 'Resolved URLs');

  // Scrape EN version
  await scrapeLocale(enUrl, 'en-GB', patchVersion, outputDir);

  // Small delay to be respectful to the server
  await delayBetweenRequests(REQUEST_DELAY_MS);

  // Scrape FR version
  await scrapeLocale(frUrl, 'fr-FR', patchVersion, outputDir);

  logger.info({ patchVersion }, 'Patch scrape complete');
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
    // Fetch HTML
    const html = await fetchPage(url);

    // Parse changes
    const rawEntities = parsePatchHtml(html, locale);

    // Clean, enrich ids, normalize
    let cleanedEntities = cleanChanges(rawEntities);
    cleanedEntities = await enrichEntitiesWithGameData(cleanedEntities);
    cleanedEntities = deduplicateEntities(cleanedEntities);
    cleanedEntities = sortEntities(cleanedEntities);

    // Download summary infographic (patch-highlights section)
    const summaryImage = await downloadSummaryImage(html, patchVersion, locale, outputDir);

    // Build output structure
    const patchJson: PatchJson = {
      patchVersion,
      locale,
      scrapedAt: new Date().toISOString(),
      url,
      summaryImage,
      entities: cleanedEntities,
    };

    // Write to file
    const filename = `patch-${patchVersion}-${locale}.json`;
    await writePatchJson(outputDir, filename, patchJson);

    logger.info(
      { locale, entities: cleanedEntities.length, changes: cleanedEntities.reduce((s, e) => s + e.changes.length, 0) },
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
    const filename = `patch-${patchVersion}-en-GB.json`;
    await writePatchJson(outputDir, filename, results.en);
  } catch (error) {
    logger.error({ url: enUrl, error }, 'Failed to scrape EN');
  }

  await delayBetweenRequests(REQUEST_DELAY_MS);

  // FR
  try {
    results.fr = await scrapeLocaleWithResult(frUrl, 'fr-FR', patchVersion, outputDir);
    const filename = `patch-${patchVersion}-fr-FR.json`;
    await writePatchJson(outputDir, filename, results.fr);
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
    const imageBuffer = await fetchBinary(extracted.url);
    const filename = buildSummaryImageFilename(patchVersion, locale, extracted.url);
    const localPath = await writePatchImage(outputDir, filename, imageBuffer);

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
