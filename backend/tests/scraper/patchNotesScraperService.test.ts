import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { scrapePatchNotesIfNeeded } from '../../src/services/PatchNotesScraperService.js';

describe('PatchNotesScraperService', () => {
  let tempDir: string;
  const originalEnv = process.env.PATCH_OUTPUT_DIR;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'patch-scrape-'));
    process.env.PATCH_OUTPUT_DIR = tempDir;
  });

  afterEach(async () => {
    if (originalEnv) process.env.PATCH_OUTPUT_DIR = originalEnv;
    else delete process.env.PATCH_OUTPUT_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should skip when both locale files already exist', async () => {
    await mkdir(tempDir, { recursive: true });
    await writeFile(join(tempDir, 'patch-26.11-en-GB.json'), '{}');
    await writeFile(join(tempDir, 'patch-26.11-fr-FR.json'), '{}');

    const result = await scrapePatchNotesIfNeeded('26.11.1', 'test');

    expect(result.ok).toBe(true);
    if (result.ok && !result.scraped) {
      expect(result.reason).toBe('already_scraped');
      expect(result.patchVersion).toBe('26.11');
    }
  });
});
