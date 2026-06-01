import { afterEach, describe, expect, test, vi } from 'vitest';
import { orchestrationLogger } from '../../../src/poll-orchestration/logger.js';

const defaultVersions = {
  versions: [
    { version: '16.11.1', releaseDate: '2026-05-27', patchLabel: '16.11' },
    { version: '16.10.1', releaseDate: '2026-05-12', patchLabel: '16.10' },
  ],
};

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify(defaultVersions)),
}));

import { PatchResolver } from '../../../src/poll-orchestration/PatchResolver.js';
import { readFileSync } from 'node:fs';

describe('PatchResolver', () => {
  test('getCurrentPatch returns newest patch', () => {
    const current = PatchResolver.getCurrentPatch();
    expect(current.patch).toBe('16.11');
    expect(current.endDate).toBeNull();
  });

  test('startTimestamp is UTC epoch seconds', () => {
    const current = PatchResolver.getCurrentPatch();
    expect(current.startTimestamp).toBe(Math.floor(Date.parse('2026-05-27T00:00:00Z') / 1000));
  });

  test('getPatchByName returns entry', () => {
    const patch = PatchResolver.getPatchByName('16.10');
    expect(patch.patch).toBe('16.10');
  });

  test('getPatchByName throws for unknown', () => {
    expect(() => PatchResolver.getPatchByName('99.99')).toThrow();
  });

  test('getAllPatches sorted by startDate desc', () => {
    const patches = PatchResolver.getAllPatches();
    expect(patches[0]?.patch).toBe('16.11');
    expect(patches[1]?.patch).toBe('16.10');
    expect(patches[0]?.endDate).toBeNull();
    expect(patches[1]?.endDate).toBe('2026-05-27');
  });

  test('getPatchByName returns 16.10', () => {
    expect(PatchResolver.getPatchByName('16.10').startDate).toBe('2026-05-12');
  });

  test('throws when versions.json has no versions', () => {
    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify({ versions: [] }));
    expect(() => PatchResolver.getAllPatches()).toThrow(/versions/);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(defaultVersions));
  });

  test('warns when current patch is older than 30 days', () => {
    const warnSpy = vi.spyOn(orchestrationLogger, 'warn').mockImplementation(() => undefined);
    vi.mocked(readFileSync).mockReturnValueOnce(
      JSON.stringify({
        versions: [{ version: '1.0.0', releaseDate: '2020-01-01', patchLabel: '1.0' }],
      }),
    );
    PatchResolver.getCurrentPatch();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'PatchResolver', patch: '1.0' }),
      expect.stringContaining('stale'),
    );
    warnSpy.mockRestore();
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(defaultVersions));
  });
});

afterEach(() => {
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify(defaultVersions));
});
