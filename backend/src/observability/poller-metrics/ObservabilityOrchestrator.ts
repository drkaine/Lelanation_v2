import type { Queue } from 'bullmq';
import type { RiotGateway } from '../../riot-gateway/gateway/RiotGateway.js';
import { AggregateComputer } from './AggregateComputer.js';
import { AggregateReporter } from './AggregateReporter.js';
import { AlertDetector } from './AlertDetector.js';
import { LiveTokenDisplay } from './LiveTokenDisplay.js';
import { MetricsStore } from './MetricsStore.js';
import { SnapshotPersistence } from './SnapshotPersistence.js';
import { pollerMetricsLogger } from './logger.js';

export class ObservabilityOrchestrator {
  private static instance: ObservabilityOrchestrator | null = null;

  private readonly store = MetricsStore.getInstance();
  private readonly computer = new AggregateComputer(this.store);
  private readonly persistence = new SnapshotPersistence();
  private readonly alertDetector = new AlertDetector(this.store);
  private readonly reporter: AggregateReporter;
  private readonly liveDisplay: LiveTokenDisplay;
  private queuePoller: NodeJS.Timeout | null = null;

  private constructor(
    gateway: RiotGateway,
    queue: Queue,
  ) {
    this.liveDisplay = new LiveTokenDisplay(gateway, queue, this.store);
    this.reporter = new AggregateReporter(this.computer, this.persistence, gateway, this.alertDetector);
  }

  static getInstance(gateway: RiotGateway, queue: Queue): ObservabilityOrchestrator {
    if (!ObservabilityOrchestrator.instance) {
      ObservabilityOrchestrator.instance = new ObservabilityOrchestrator(gateway, queue);
    }
    return ObservabilityOrchestrator.instance;
  }

  static resetInstance(): void {
    ObservabilityOrchestrator.instance?.stop();
    ObservabilityOrchestrator.instance = null;
    MetricsStore.resetInstance();
  }

  async start(): Promise<void> {
    await this.persistence.load();
    this.liveDisplay.start();
    this.reporter.start();

    this.queuePoller = setInterval(() => {
      void this.pollQueueDepth();
    }, 10_000);

    pollerMetricsLogger.info({ component: 'observability' }, 'observability started');
  }

  stop(): void {
    this.liveDisplay.stop();
    this.reporter.stop();
    if (this.queuePoller) {
      clearInterval(this.queuePoller);
      this.queuePoller = null;
    }
  }

  getStore(): MetricsStore {
    return this.store;
  }

  private async pollQueueDepth(): Promise<void> {
    try {
      const { ingestionQueue } = await import('../../queues/index.js');
      const counts = await ingestionQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
      const waiting = counts.waiting ?? 0;
      const active = counts.active ?? 0;
      this.store.pushQueueDepth({
        ts: Date.now(),
        waiting,
        active,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        total: waiting + active,
      });
    } catch (error) {
      pollerMetricsLogger.trace(
        { component: 'observability', error: error instanceof Error ? error.message : String(error) },
        'queue depth poll failed',
      );
    }
  }
}
