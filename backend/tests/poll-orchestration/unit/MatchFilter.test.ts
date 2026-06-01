import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../src/db/client.js', () => ({
  sql: Object.assign(vi.fn(), { array: (values: unknown[]) => values }),
}));

import { sql } from '../../../src/db/client.js';
import { MatchFilter } from '../../../src/poll-orchestration/MatchFilter.js';

describe('MatchFilter', () => {
  beforeEach(() => {
    vi.mocked(sql).mockReset();
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

  test('error status rows are not treated as known (retry allowed)', async () => {
    vi.mocked(sql).mockResolvedValueOnce([]);
    const filter = new MatchFilter();
    expect(await filter.filterNew(['EUW1_ERROR_RETRY'])).toEqual(['EUW1_ERROR_RETRY']);
    expect(sql).toHaveBeenCalledTimes(1);
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
