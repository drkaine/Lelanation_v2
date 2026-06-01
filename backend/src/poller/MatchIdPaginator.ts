import { recordMatchDiscovery } from '../observability/poller-metrics/instrumentation.js';
import { fetchMatchIdsByPUUID } from './gatewayRoutes.js';
import { pollerLogger } from './logger.js';
import type { PollerEventBus } from './PollerEventBus.js';
import type { Player, PollConfig } from './types.js';

export class MatchIdPaginator {
  constructor(
    private readonly player: Player,
    private readonly config: PollConfig,
    private readonly eventBus: PollerEventBus,
    private readonly sessionId: string,
  ) {}

  async fetchAll(): Promise<string[]> {
    const all: string[] = [];
    let page = 0;
    let offset = 0;

    while (true) {
      page += 1;
      pollerLogger.debug(
        {
          component: 'MatchIdPaginator',
          sessionId: this.sessionId,
          puuid: this.player.puuid,
          page,
          offset,
          count: this.config.matchIdsPerPage,
          sinceTimestamp: this.config.sinceTimestamp,
        },
        'fetching page',
      );

      try {
        const batch = await fetchMatchIdsByPUUID(this.player.puuid, this.player.platform, {
          start: offset,
          count: this.config.matchIdsPerPage,
          startTime: this.config.sinceTimestamp,
        });

        all.push(...batch);
        for (const matchId of batch) {
          recordMatchDiscovery({ puuid: this.player.puuid, matchId, type: 'new' });
        }
        this.eventBus.emit('match:ids', {
          sessionId: this.sessionId,
          player: this.player,
          matchIds: batch,
          page,
          total: all.length,
        });

        pollerLogger.debug(
          {
            component: 'MatchIdPaginator',
            sessionId: this.sessionId,
            puuid: this.player.puuid,
            page,
            returned: batch.length,
            cumulative: all.length,
            hasMore: batch.length >= this.config.matchIdsPerPage,
          },
          'page result',
        );

        const cap = this.config.maxMatchesToProcess;
        if (cap != null && all.length >= cap) {
          return all.slice(0, cap);
        }

        if (batch.length < this.config.matchIdsPerPage) break;
        offset += batch.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pollerLogger.warn(
          {
            component: 'MatchIdPaginator',
            sessionId: this.sessionId,
            puuid: this.player.puuid,
            page,
            error: message,
            partialResults: all.length,
          },
          'pagination error',
        );
        break;
      }
    }

    return all;
  }
}
