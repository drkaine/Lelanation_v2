import { describe, expect, test, vi } from 'vitest';
import { MatchIdPaginator } from '../../../../src/poller/MatchIdPaginator.js';
import { PollerEventBus } from '../../../../src/poller/PollerEventBus.js';
import { mergePollConfig } from '../../../../src/poller/types.js';

vi.mock('../../../../src/poller/gatewayRoutes.js', () => ({
  fetchMatchIdsByPUUID: vi.fn(async () => []),
}));

import { fetchMatchIdsByPUUID } from '../../../../src/poller/gatewayRoutes.js';

const config = mergePollConfig({ sinceTimestamp: 1_000 });

describe('MatchIdPaginator fenêtre par joueur', () => {
  test('startTime = sinceTimestamp du joueur si présent', async () => {
    const player = { puuid: 'p', platform: 'euw1' as const, sinceTimestamp: 5_000 };
    await new MatchIdPaginator(player, config, new PollerEventBus(), 's').fetchAll();
    expect(vi.mocked(fetchMatchIdsByPUUID).mock.calls[0]?.[2]).toMatchObject({ startTime: 5_000 });
  });
  test('sinon startTime global', async () => {
    vi.mocked(fetchMatchIdsByPUUID).mockClear();
    await new MatchIdPaginator({ puuid: 'p', platform: 'euw1' }, config, new PollerEventBus(), 's').fetchAll();
    expect(vi.mocked(fetchMatchIdsByPUUID).mock.calls[0]?.[2]).toMatchObject({ startTime: 1_000 });
  });
});
