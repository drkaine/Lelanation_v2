import type { RiotGateway } from '../../riot-gateway/gateway/RiotGateway.js';
import type { AlertDetector } from './AlertDetector.js';
import type { AggregateComputer } from './AggregateComputer.js';
import { pollerMetricsLogger } from './logger.js';
import type { SnapshotPersistence } from './SnapshotPersistence.js';
import type { WindowLabel } from './types.js';

const REPORT_INTERVALS: Record<WindowLabel, number> = {
  '10m': 10 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export class AggregateReporter {
  private readonly timers = new Map<WindowLabel, NodeJS.Timeout>();

  constructor(
    private readonly computer: AggregateComputer,
    private readonly persistence: SnapshotPersistence,
    private readonly gateway: RiotGateway,
    private readonly alertDetector: AlertDetector,
  ) {}

  start(): void {
    for (const [label, intervalMs] of Object.entries(REPORT_INTERVALS) as Array<[WindowLabel, number]>) {
      const timer = setInterval(() => void this.report(label), intervalMs);
      this.timers.set(label, timer);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  private getLimit(): { limit120s: number; limit1s: number } {
    const status = this.gateway.getStatus();
    const app120 = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 120_000);
    const app1s = status.buckets.find((b) => b.bucketId.startsWith('app:') && b.windowMs === 1_000);
    return { limit120s: app120?.limit ?? 99, limit1s: app1s?.limit ?? 19 };
  }

  private async report(window: WindowLabel): Promise<void> {
    const { limit120s, limit1s } = this.getLimit();
    const activeAlerts = this.alertDetector.getActive();
    const snapshot = this.computer.computeFull(window, limit120s, limit1s, activeAlerts);

    if (window === '10m') {
      this.alertDetector.check(snapshot);
      snapshot.active_alerts = this.alertDetector.getActive();
    }

    pollerMetricsLogger.info({
      component: 'aggregate-reporter',
      window,
      gateway: snapshot.gateway,
      poll: snapshot.poll,
      ingestion: snapshot.ingestion,
      ratios: snapshot.ratios,
      active_alerts: snapshot.active_alerts,
    });

    await this.persistence.save(window, snapshot);
  }
}
