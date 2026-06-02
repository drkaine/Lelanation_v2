import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { array: (values: unknown[]) => values }),
}));
vi.mock('../../../src/poll-orchestration/PatchResolver.js', () => ({
  PatchResolver: {
    getAllPatches: vi.fn(() => [{ patch: '15.10' }, { patch: '15.9' }]),
  },
}));

import { sql } from '../../../src/db/client.js';
import { MatchFilter } from '../../../src/poll-orchestration/MatchFilter.js';
import { PatchResolver } from '../../../src/poll-orchestration/PatchResolver.js';

describe('MatchFilter', () => {
  beforeEach(() => {
    vi.mocked(sql).mockReset();
    vi.mocked(PatchResolver.getAllPatches).mockReturnValue([{ patch: '15.10' }, { patch: '15.9' }] as never);
  });

  test('empty input returns empty', async () => {
    const filter = new MatchFilter();
    expect(await filter.filterNew([])).toEqual([]);
    expect(sql).not.toHaveBeenCalled();
  });

  test('returns only unknown match ids', async () => {
    vi.mocked(sql).mockResolvedValueOnce([{ riot_match_id: 'EUW1_1' }]);
    const filter = new MatchFilter();
    const result = await filter.filterNew(['EUW1_1', 'EUW1_2', 'EUW1_3']);
    expect(result).toEqual(['EUW1_2', 'EUW1_3']);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  test('all known returns empty', async () => {
    vi.mocked(sql).mockResolvedValueOnce([
      { riot_match_id: 'EUW1_1' },
      { riot_match_id: 'EUW1_2' },
    ]);
    const filter = new MatchFilter();
    expect(await filter.filterNew(['EUW1_1', 'EUW1_2'])).toEqual([]);
  });

  test('all unknown returns all', async () => {
    vi.mocked(sql).mockResolvedValueOnce([]);
    const filter = new MatchFilter();
    expect(await filter.filterNew(['EUW1_1', 'EUW1_2'])).toEqual(['EUW1_1', 'EUW1_2']);
  });

  test('error status rows are treated as known', async () => {
    vi.mocked(sql).mockResolvedValueOnce([{ riot_match_id: 'EUW1_ERROR_RETRY' }]);
    const filter = new MatchFilter();
    expect(await filter.filterNew(['EUW1_ERROR_RETRY'])).toEqual([]);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  test('old partition matches are filtered when patch hint includes older patches', async () => {
    vi.mocked(PatchResolver.getAllPatches).mockReturnValue([{ patch: '15.9' }, { patch: '15.10' }] as never);
    vi.mocked(sql).mockResolvedValueOnce([{ riot_match_id: 'EUW1_OLDPATCH' }]);
    const filter = new MatchFilter();
    expect(await filter.filterNew(['EUW1_OLDPATCH'])).toEqual([]);
  });

  test('mixed filter returns only new', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `EUW1_${i}`);
    vi.mocked(sql).mockResolvedValueOnce([
      { riot_match_id: 'EUW1_0' },
      { riot_match_id: 'EUW1_1' },
      { riot_match_id: 'EUW1_2' },
    ]);
    const filter = new MatchFilter();
    const result = await filter.filterNew(ids);
    expect(result).toHaveLength(7);
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
