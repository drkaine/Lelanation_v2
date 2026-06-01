import type { Queue } from 'bullmq';
import { orchestrationLogger } from './logger.js';

export class BackpressureMonitor {
  private lastWarnAt = 0;

  constructor(
    private readonly queue: Queue,
    private readonly threshold: number,
    private readonly pollIntervalMs: number,
  ) {}

  async getDepth(): Promise<{ waiting: number; active: number; total: number }> {
    const counts = await this.queue.getJobCounts('waiting', 'active', 'prioritized', 'delayed');
    const waiting = (counts.waiting ?? 0) + (counts.prioritized ?? 0) + (counts.delayed ?? 0);
    const active = counts.active ?? 0;
    return { waiting, active, total: waiting + active };
  }

  async isOverloaded(): Promise<boolean> {
    const depth = await this.getDepth();
    orchestrationLogger.trace(
      {
        component: 'BackpressureMonitor',
        ...depth,
        threshold: this.threshold,
        overloaded: depth.total > this.threshold,
      },
      'backpressure check',
    );
    return depth.total > this.threshold;
  }

  async waitForHeadroom(): Promise<void> {
    while (await this.isOverloaded()) {
      const depth = await this.getDepth();
      const now = Date.now();
      if (now - this.lastWarnAt >= 30_000) {
        this.lastWarnAt = now;
        orchestrationLogger.warn(
          {
            component: 'BackpressureMonitor',
            ...depth,
            threshold: this.threshold,
          },
          'ingestion queue overloaded, pausing discovery',
        );
      }
      await sleep(this.pollIntervalMs);
    }

    const depth = await this.getDepth();
    if (this.lastWarnAt > 0) {
      orchestrationLogger.info(
        { component: 'BackpressureMonitor', ...depth },
        'ingestion queue headroom restored, resuming discovery',
      );
      this.lastWarnAt = 0;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
