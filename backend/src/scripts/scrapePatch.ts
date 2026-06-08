#!/usr/bin/env node
/**
 * CLI script to scrape League of Legends patch notes
 * Usage: tsx src/scripts/scrapePatch.ts <patch-url> [output-dir]
 * Example: tsx src/scripts/scrapePatch.ts https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-11-notes/
 */

import { scrapePatch } from '../scraper/patchScraper.js';
import { publishPatchNotesToFrontend } from '../services/PatchNotesPublishService.js';
import { extractPatchVersion, notesUrlVersionToPatchLabel } from '../utils/helpers.js';
import { logger } from '../utils/logger.js';

const DEFAULT_OUTPUT_DIR = './data/patches';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: tsx src/scripts/scrapePatch.ts <patch-url> [output-dir]');
    console.error('');
    console.error('Example:');
    console.error('  tsx src/scripts/scrapePatch.ts https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-11-notes/');
    console.error('');
    console.error('Environment variables:');
    console.error('  PATCH_OUTPUT_DIR  - Default output directory (default: ./data/patches)');
    process.exit(1);
  }

  const [enUrl, outputDirArg] = args;
  const outputDir = outputDirArg || process.env.PATCH_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;

  logger.info({ url: enUrl, outputDir }, 'Starting patch scrape from CLI');

  try {
    await scrapePatch(enUrl, outputDir, undefined, { triggeredBy: 'scrapePatchCli' });

    const patchVersion = notesUrlVersionToPatchLabel(extractPatchVersion(enUrl));
    const publishResult = await publishPatchNotesToFrontend(patchVersion, 'scrapePatchCli');
    logger.info('Patch notes moved to frontend', { moved: publishResult.moved, deleted: publishResult.deleted });

    console.log(`✓ Patch notes scraped to: ${outputDir}`);
    console.log(`✓ Moved to frontend (${publishResult.moved} files, latest: ${publishResult.index.latest})`);
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMessage }, 'Patch scrape failed');
    console.error(`✗ Patch scrape failed: ${errorMessage}`);
    process.exit(1);
  }
}

main();
