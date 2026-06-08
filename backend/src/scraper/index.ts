/**
 * Patch Scraper module - exports
 */

export { scrapePatch, scrapePatchWithResult } from './patchScraper.js';
export { fetchPage, fetchBinary, delayBetweenRequests } from './fetcher.js';
export {
  parsePatchHtml,
  parsePatchHtmlAlt,
  extractSummaryImageUrl,
  normalizeCmsImageUrl,
  buildSummaryImageFilename,
} from './parser.js';
export { cleanChanges, deduplicateEntities, sortEntities } from './cleaner.js';
export {
  extractEntityIdFromHtml,
  enrichEntityIds,
  buildGameDataIndexes,
  championSlugToId,
  patchSlugToRuneKey,
} from './entityIds.js';
export { loadGameDataIndexes } from './gameDataLoader.js';
export {
  runPatchPreflight,
  assertPatchReadyToScrape,
  PatchPreflightError,
} from './patchPreflight.js';
export { notifyPatchScrapeFailure } from './patchScrapeAlerts.js';
export type {
  ChangeType,
  Locale,
  EntityCategory,
  StatChange,
  EntityChanges,
  PatchJson,
  PatchSummaryImage,
} from './types.js';
