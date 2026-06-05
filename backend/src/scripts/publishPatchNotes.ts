#!/usr/bin/env node
/**
 * Publish all backend patch notes to frontend/public/data/patch-notes
 */
import { publishAllPatchNotesToFrontend } from '../services/PatchNotesPublishService.js';

async function main(): Promise<void> {
  const result = await publishAllPatchNotesToFrontend('publishPatchNotesCli');
  console.log(`✓ Moved ${result.moved} files (${result.deleted} deleted from backend) — latest: ${result.index.latest ?? 'none'}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('✗ Publish failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
