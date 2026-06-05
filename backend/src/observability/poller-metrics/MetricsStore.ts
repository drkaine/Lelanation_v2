import { CircularBuffer } from './CircularBuffer.js';
import type {
  DbOperationEvent,
  GatewayRequestEvent,
  IngestionQueueEvent,
  IngestionWorkerEvent,
  MatchDiscoveryEvent,
  MatchFetchEvent,
  PlayerEvent,
  PollSessionEvent,
  QueueDepthEvent,
  RankEvent,
  RateLimitSaturationEvent,
  AlertLifecycleEvent,
  SessionPoolEvent,
  TokenSnapshotEvent,
} from './types.js';

export class MetricsStore {
  private static instance: MetricsStore | null = null;

  readonly gateway = new CircularBuffer<GatewayRequestEvent>(10_000);
  readonly tokenSnap = new CircularBuffer<TokenSnapshotEvent>(8_640);
  readonly saturation = new CircularBuffer<RateLimitSaturationEvent>(500);
  readonly pollSession = new CircularBuffer<PollSessionEvent>(500);
  readonly playerEvents = new CircularBuffer<PlayerEvent>(50_000);
  readonly rankEvents = new CircularBuffer<RankEvent>(100_000);
  readonly matchDiscovery = new CircularBuffer<MatchDiscoveryEvent>(100_000);
  readonly matchFetch = new CircularBuffer<MatchFetchEvent>(50_000);
  readonly ingestionQueue = new CircularBuffer<IngestionQueueEvent>(50_000);
  readonly ingestionWorker = new CircularBuffer<IngestionWorkerEvent>(50_000);
  readonly dbOperations = new CircularBuffer<DbOperationEvent>(50_000);
  readonly queueDepth = new CircularBuffer<QueueDepthEvent>(8_640);
  readonly sessionPool = new CircularBuffer<SessionPoolEvent>(500);
  readonly alertLifecycle = new CircularBuffer<AlertLifecycleEvent>(5_000);

  private readonly startedAt = Date.now();

  static getInstance(): MetricsStore {
    if (!MetricsStore.instance) {
      MetricsStore.instance = new MetricsStore();
    }
    return MetricsStore.instance;
  }

  static resetInstance(): void {
    MetricsStore.instance = null;
  }

  getUptimeMs(): number {
    return Date.now() - this.startedAt;
  }

  pushGatewayRequest(e: GatewayRequestEvent): void {
    this.gateway.push(e);
  }

  pushTokenSnapshot(e: TokenSnapshotEvent): void {
    this.tokenSnap.push(e);
  }

  pushSaturation(e: RateLimitSaturationEvent): void {
    this.saturation.push(e);
  }

  pushPollSession(e: PollSessionEvent): void {
    this.pollSession.push(e);
  }

  pushPlayer(e: PlayerEvent): void {
    this.playerEvents.push(e);
  }

  pushRank(e: RankEvent): void {
    this.rankEvents.push(e);
  }

  pushMatchDiscovery(e: MatchDiscoveryEvent): void {
    this.matchDiscovery.push(e);
  }

  pushMatchFetch(e: MatchFetchEvent): void {
    this.matchFetch.push(e);
  }

  pushIngestionQueue(e: IngestionQueueEvent): void {
    this.ingestionQueue.push(e);
  }

  pushIngestionWorker(e: IngestionWorkerEvent): void {
    this.ingestionWorker.push(e);
  }

  pushDbOperation(e: DbOperationEvent): void {
    this.dbOperations.push(e);
  }

  pushQueueDepth(e: QueueDepthEvent): void {
    this.queueDepth.push(e);
  }

  pushSessionPool(e: SessionPoolEvent): void {
    this.sessionPool.push(e);
  }

  pushAlertLifecycle(e: AlertLifecycleEvent): void {
    this.alertLifecycle.push(e);
  }
}
