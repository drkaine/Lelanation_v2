import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createSqlMock, resetSqlMockState, seedKnownMatch } from '../helpers/sqlMockState.js';

vi.mock('../../../src/db/client.js', async () => {
  const { createSqlMock } = await import('../helpers/sqlMockState.js');
  return { sql: createSqlMock() };
});

import { MatchFilter } from '../../../src/poll-orchestration/MatchFilter.js';

describe('MatchFilter (sql mock)', () => {
  beforeEach(() => {
    resetSqlMockState();
  });

  test('known match in matchs is filtered out', async () => {
    seedKnownMatch('EUW1_KNOWN');
    const filter = new MatchFilter();
    expect(await filter.filterNew(['EUW1_KNOWN', 'EUW1_NEW'])).toEqual(['EUW1_NEW']);
  });
});
