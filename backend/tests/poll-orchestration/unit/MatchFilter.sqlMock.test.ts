import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSqlMock, resetSqlMockState, seedProcessedMatch } from '../helpers/sqlMockState.js';

vi.mock('../../../src/db/client.js', async () => {
  const { createSqlMock } = await import('../helpers/sqlMockState.js');
  return { sql: createSqlMock() };
});

import { MatchFilter } from '../../../src/poll-orchestration/MatchFilter.js';

describe('MatchFilter (sql mock)', () => {
  beforeEach(() => {
    resetSqlMockState();
  });

  test('error status is not filtered out', async () => {
    seedProcessedMatch('EUW1_FAILED', 'error');
    const filter = new MatchFilter();
    expect(await filter.filterNew(['EUW1_FAILED', 'EUW1_NEW'])).toEqual(['EUW1_FAILED', 'EUW1_NEW']);
  });
});
