import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { access } from 'fs/promises';
import {
  movePatchVersionToFrontend,
  rebuildPatchNotesIndex,
  publishPatchNotesToFrontend,
} from '../../src/services/PatchNotesPublishService.js';

describe('PatchNotesPublishService', () => {
  let backendDir: string;
  let frontendDir: string;
  const originalBackend = process.env.PATCH_OUTPUT_DIR;
  const originalFrontend = process.env.PATCH_FRONTEND_DIR;

  beforeEach(async () => {
    backendDir = await mkdtemp(join(tmpdir(), 'patch-backend-'));
    frontendDir = await mkdtemp(join(tmpdir(), 'patch-frontend-'));
    process.env.PATCH_OUTPUT_DIR = backendDir;
    process.env.PATCH_FRONTEND_DIR = frontendDir;
  });

  afterEach(async () => {
    if (originalBackend) process.env.PATCH_OUTPUT_DIR = originalBackend;
    else delete process.env.PATCH_OUTPUT_DIR;
    if (originalFrontend) process.env.PATCH_FRONTEND_DIR = originalFrontend;
    else delete process.env.PATCH_FRONTEND_DIR;
    await rm(backendDir, { recursive: true, force: true });
    await rm(frontendDir, { recursive: true, force: true });
  });

  it('should move patch files to frontend and delete from backend', async () => {
    await writeFile(join(backendDir, 'patch-26.10-en-GB.json'), '{"scrapedAt":"2026-05-01T00:00:00.000Z"}');
    await writeFile(join(backendDir, 'patch-26.11-fr-FR.json'), '{"scrapedAt":"2026-06-05T00:00:00.000Z"}');
    await writeFile(join(frontendDir, 'patch-26.10-fr-FR.json'), '{"old":true}');

    const result = await movePatchVersionToFrontend('26.11');
    expect(result.moved).toBe(1);
    expect(result.deleted).toBe(1);

    const frontendFiles = await readFile(join(frontendDir, 'patch-26.11-fr-FR.json'), 'utf-8');
    expect(frontendFiles).toContain('scrapedAt');

    await expect(access(join(backendDir, 'patch-26.11-fr-FR.json'))).rejects.toThrow();

    const oldStillThere = await readFile(join(frontendDir, 'patch-26.10-fr-FR.json'), 'utf-8');
    expect(oldStillThere).toContain('old');
  });

  it('should rebuild index.json with latest patch first', async () => {
    await mkdir(frontendDir, { recursive: true });
    await writeFile(join(frontendDir, 'patch-26.10-en-GB.json'), '{"scrapedAt":"2026-05-01T00:00:00.000Z"}');
    await writeFile(join(frontendDir, 'patch-26.11-en-GB.json'), '{"scrapedAt":"2026-06-05T00:00:00.000Z"}');
    await writeFile(join(frontendDir, 'patch-26.11-fr-FR.json'), '{"scrapedAt":"2026-06-05T00:00:00.000Z"}');
    await writeFile(join(frontendDir, 'patch-26.11-fr-FR-summary.png'), 'png');

    const index = await rebuildPatchNotesIndex(frontendDir);
    expect(index.latest).toBe('26.11');
    expect(index.patches).toHaveLength(2);
    expect(index.patches[0].version).toBe('26.11');
    expect(index.patches[0].files.summary['fr-FR']).toBe('patch-26.11-fr-FR-summary.png');
  });

  it('should publish patch and write index.json', async () => {
    await writeFile(join(backendDir, 'patch-26.11-en-GB.json'), '{"scrapedAt":"2026-06-05T00:00:00.000Z"}');
    await writeFile(join(backendDir, 'patch-26.11-fr-FR.json'), '{"scrapedAt":"2026-06-05T00:00:00.000Z"}');

    const result = await publishPatchNotesToFrontend('26.11');
    expect(result.moved).toBe(2);
    expect(result.deleted).toBe(2);
    expect(result.index.latest).toBe('26.11');

    const indexRaw = await readFile(join(frontendDir, 'index.json'), 'utf-8');
    const index = JSON.parse(indexRaw);
    expect(index.patches[0].version).toBe('26.11');
  });
});
