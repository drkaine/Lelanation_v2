import type { PlayerDiscovery } from './PlayerDiscovery.js';
import { orchestrationLogger } from './logger.js';
import type { DiscoveryPlayer } from './types.js';

const REFILL_POLL_MS = Number.parseInt(process.env.PLAYER_QUEUE_REFILL_POLL_MS ?? '2000', 10);

export interface PlayerQueueConfig {
  highWaterMark: number;
  lowWaterMark: number;
  fetchBatchSize: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class PlayerQueue {
  private queue: DiscoveryPlayer[] = [];
  private refilling = false;
  private exhausted = false;

  constructor(
    private readonly discovery: PlayerDiscovery,
    private readonly config: PlayerQueueConfig,
  ) {}

  dequeue(n: number): DiscoveryPlayer[] {
    const count = Math.max(0, Math.min(n, this.queue.length));
    const out = this.queue.splice(0, count);
    if (this.queue.length < this.config.lowWaterMark) {
      void this.refill();
    }
    return out;
  }

  isExhausted(): boolean {
    return this.exhausted && this.queue.length === 0;
  }

  get size(): number {
    return this.queue.length;
  }

  /**
   * Wait until at least n players are available or the pool is exhausted.
   */
  async waitForPlayers(n: number, timeoutMs = 30_000): Promise<DiscoveryPlayer[]> {
    const deadline = Date.now() + timeoutMs;
    let pollMs = 100;

    while (Date.now() < deadline) {
      if (this.queue.length >= n) {
        return this.dequeue(n);
      }
      if (this.queue.length < this.config.lowWaterMark && !this.refilling) {
        await this.refill();
      }
      if (this.queue.length >= n) {
        return this.dequeue(n);
      }
      await sleep(pollMs);
      pollMs = Math.min(REFILL_POLL_MS, pollMs * 2);
    }

    return this.dequeue(Math.min(n, this.queue.length));
  }

  /** Prime the buffer on startup. */
  async prime(): Promise<void> {
    await this.refill();
  }

  private async refill(): Promise<void> {
    if (this.refilling) return;
    if (this.queue.length >= this.config.highWaterMark) return;

    this.refilling = true;
    try {
      const room = this.config.highWaterMark - this.queue.length;
      const fetchSize = Math.min(this.config.fetchBatchSize, room);
      if (fetchSize <= 0) return;

      const wasExhausted = this.exhausted;
      const fetched = await this.discovery.fetchNextBatch(fetchSize);
      if (fetched.length > 0) {
        this.queue.push(...fetched);
        if (wasExhausted) {
          orchestrationLogger.info(
            {
              component: 'PlayerQueue',
              fetched: fetched.length,
              queueSize: this.queue.length,
            },
            'player pool recovered from exhausted',
          );
        }
        this.exhausted = false;
      } else if (this.queue.length === 0) {
        if (!this.exhausted) {
          orchestrationLogger.info(
            { component: 'PlayerQueue', reason: 'all_players_polled_recently' },
            'player pool exhausted',
          );
        }
        this.exhausted = true;
      } else if (fetched.length < fetchSize) {
        this.exhausted = true;
      }

      orchestrationLogger.debug(
        {
          component: 'PlayerQueue',
          fetched: fetched.length,
          queueSize: this.queue.length,
          exhausted: this.exhausted,
        },
        'player queue refill',
      );
    } finally {
      this.refilling = false;
    }
  }
}
