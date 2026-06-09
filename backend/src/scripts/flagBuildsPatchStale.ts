#!/usr/bin/env node
/**
 * Flag builds impacted by patch notes (champions, items, runes tabs only).
 *
 * Usage:
 *   tsx src/scripts/flagBuildsPatchStale.ts --all
 *   tsx src/scripts/flagBuildsPatchStale.ts
 *   tsx src/scripts/flagBuildsPatchStale.ts --patch 16.11
 */

import { flagBuildsPatchStale } from '../services/BuildPatchStaleService.js';
import { rebuildPatchNotesIndex } from '../services/PatchNotesPublishService.js';
import { logger } from '../utils/logger.js';

function parseArgs(argv: string[]): { mode: 'all' | 'latest'; patchVersion?: string } {
  const all = argv.includes('--all');
  const patchFlagIndex = argv.findIndex((arg) => arg === '--patch');
  const patchVersion =
    patchFlagIndex >= 0 ? argv[patchFlagIndex + 1]?.trim() : undefined;

  if (all) {
    return { mode: 'all' };
  }

  return { mode: 'latest', patchVersion };
}

async function main(): Promise<void> {
  const { mode, patchVersion } = parseArgs(process.argv.slice(2));
  const index = await rebuildPatchNotesIndex();

  const result = await flagBuildsPatchStale({
    mode,
    patchVersion: patchVersion ?? index.latest ?? undefined,
    cronName: 'flagBuildsPatchStaleCli',
  });

  logger.info('Build patch stale script finished', result);

  console.log(`✓ Patch stale flagging (${mode})`);
  console.log(`  Patches: ${result.patchVersions.join(', ') || 'none'}`);
  console.log(`  Scanned: ${result.scanned}`);
  console.log(`  Flagged: ${result.flagged}`);
  console.log(`  Cleared: ${result.cleared}`);
  console.log(`  Unchanged: ${result.unchanged}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error({ error: message }, 'Build patch stale script failed');
  console.error(`✗ Build patch stale script failed: ${message}`);
  process.exit(1);
});
