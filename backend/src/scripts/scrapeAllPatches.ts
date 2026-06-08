#!/usr/bin/env node
/**
 * Scrape all League of Legends patch notes from a minimum version (default 16.1).
 * Uses patch labels from data/game/versions.json (stored as 16.x, fetched from Riot as 26.x).
 * Usage: tsx src/scripts/scrapeAllPatches.ts [fromVersion]
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { scrapePatch } from '../scraper/patchScraper.js';
import {
  publishPatchNotesToFrontend,
  rebuildPatchNotesIndex,
  comparePatchVersions,
} from '../services/PatchNotesPublishService.js';
import { buildPatchNotesUrl } from '../utils/helpers.js';
import { patchFileExists } from '../utils/fileWriter.js';
import { logger } from '../utils/logger.js';

const DEFAULT_FROM = '16.1';
const DEFAULT_OUTPUT_DIR = './data/patches';
const REQUEST_DELAY_MS = 3000;

function getPatchOutputDir(): string {
  return process.env.PATCH_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
}

function getFrontendPatchNotesDir(): string {
  const fromEnv = process.env.PATCH_FRONTEND_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), '..', 'frontend', 'public', 'data', 'patch-notes');
}

async function loadPatchLabelsFromVersionsJson(fromVersion: string): Promise<string[]> {
  const versionsPath = join(process.cwd(), 'data', 'game', 'versions.json');
  const raw = await readFile(versionsPath, 'utf-8');
  const data = JSON.parse(raw) as { versions?: Array<{ patchLabel?: string }> };
  const labels = new Set<string>();

  for (const entry of data.versions ?? []) {
    if (entry.patchLabel && comparePatchVersions(fromVersion, entry.patchLabel) >= 0) {
      labels.add(entry.patchLabel);
    }
  }

  return [...labels].sort((a, b) => comparePatchVersions(a, b));
}

async function isPatchPublished(patchVersion: string): Promise<boolean> {
  const frontendDir = getFrontendPatchNotesDir();
  const [enExists, frExists] = await Promise.all([
    patchFileExists(frontendDir, patchVersion, 'en-GB'),
    patchFileExists(frontendDir, patchVersion, 'fr-FR'),
  ]);
  return enExists && frExists;
}

async function isPatchInBackend(patchVersion: string): Promise<boolean> {
  const outputDir = getPatchOutputDir();
  const [enExists, frExists] = await Promise.all([
    patchFileExists(outputDir, patchVersion, 'en-GB'),
    patchFileExists(outputDir, patchVersion, 'fr-FR'),
  ]);
  return enExists && frExists;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const fromVersion = process.argv[2]?.trim() || DEFAULT_FROM;
  const outputDir = getPatchOutputDir();
  const allPatches = await loadPatchLabelsFromVersionsJson(fromVersion);

  logger.info({ fromVersion, count: allPatches.length, outputDir }, 'Starting bulk patch scrape');

  let scraped = 0;
  let skipped = 0;
  let failed = 0;

  for (const patchVersion of allPatches) {
    if (await isPatchPublished(patchVersion)) {
      logger.info({ patchVersion }, 'Already published, skipping');
      skipped++;
      continue;
    }

    if (await isPatchInBackend(patchVersion)) {
      logger.info({ patchVersion }, 'Already in backend, publishing only');
      await publishPatchNotesToFrontend(patchVersion, 'scrapeAllPatches');
      skipped++;
      continue;
    }

    const url = buildPatchNotesUrl(patchVersion);

    try {
      logger.info({ patchVersion, url }, 'Scraping patch');
      await scrapePatch(url, outputDir, patchVersion, { triggeredBy: 'scrapeAllPatches' });
      await publishPatchNotesToFrontend(patchVersion, 'scrapeAllPatches');
      scraped++;
      console.log(`✓ Patch ${patchVersion} scraped and published`);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ patchVersion, url, error: message }, 'Patch scrape failed, continuing');
      console.warn(`✗ Patch ${patchVersion} failed: ${message}`);
    }

    await delay(REQUEST_DELAY_MS);
  }

  await rebuildPatchNotesIndex();

  console.log('');
  console.log(`Done: ${scraped} scraped, ${skipped} skipped, ${failed} failed`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
