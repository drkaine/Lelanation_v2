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
    const patchVersion = '26.11';
    const versionDir = join(tempDir, patchVersion);
    await mkdir(versionDir, { recursive: true });
    await writeFile(join(versionDir, `patch-${patchVersion}-en-GB.json`), '{}');
    await writeFile(join(versionDir, `patch-${patchVersion}-fr-FR.json`), '{}');

    const result = await scrapePatchNotesIfNeeded('26.11.1', 'test');

    expect(result.ok).toBe(true);
    if (result.ok && !result.scraped) {
      expect(result.reason).toBe('already_scraped');
      expect(result.patchVersion).toBe('26.11');
    }
  });
});
