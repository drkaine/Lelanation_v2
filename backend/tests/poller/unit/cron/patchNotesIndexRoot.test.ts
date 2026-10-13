import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

vi.mock('../../../../src/utils/cronLogger.js', () => ({
  createCronLogger: () => ({
    info: vi.fn(async () => undefined),
    warn: vi.fn(async () => undefined),
    error: vi.fn(async () => undefined),
  }),
}));

const { StaticAssetsService } = await import('../../../../src/services/StaticAssetsService.js');

describe('StaticAssetsService.movePatchNotesToFrontend', () => {
  let root: string;
  let backendPatches: string;
  let frontendPatches: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'patch-index-'));
    backendPatches = join(root, 'backend-patches');
    frontendPatches = join(root, 'frontend-patches');
    process.env.PATCH_OUTPUT_DIR = backendPatches;
    process.env.PATCH_FRONTEND_DIR = frontendPatches;

    await mkdir(join(frontendPatches, '16.16'), { recursive: true });
    await writeFile(join(frontendPatches, '16.16', 'patch-16.16-fr-FR.json'), '{}');
    await writeFile(join(frontendPatches, 'index.json'), JSON.stringify({ latest: '16.16' }));
    await mkdir(join(backendPatches, '16.20'), { recursive: true });
    await writeFile(join(backendPatches, '16.20', 'patch-16.20-fr-FR.json'), '{}');
  });

  afterEach(async () => {
    delete process.env.PATCH_OUTPUT_DIR;
    delete process.env.PATCH_FRONTEND_DIR;
    await rm(root, { recursive: true, force: true });
  });

  test('rebuilds_root_index_with_new_latest_not_version_dir_index', async () => {
    const result = await new StaticAssetsService().movePatchNotesToFrontend('16.20');
    expect(result.isOk()).toBe(true);

    const index = JSON.parse(await readFile(join(frontendPatches, 'index.json'), 'utf-8'));
    expect(index.latest).toBe('16.20');
    await expect(access(join(frontendPatches, '16.20', 'index.json'))).rejects.toThrow();
  });
});
