import crypto from 'node:crypto';
import { riotConfig, validateConfig } from '../config/riotConfig.js';
import { riotFetch, closeAllPools } from '../http/undiciClient.js';
import { gatewayLogger } from '../logger.js';
import type {
  FlushReason,
  GatewayResponse,
  GatewayStatus,
  QueuedRequest,
  RequestPriority,
  RetryReason,
  ShutdownReason,
} from '../types.js';
import {
  RiotHttpError,
  RiotMaxRetriesError,
  RiotNetworkError,
  RiotShutdownError,
} from '../types.js';
import { recordGatewayRequest, recordSaturation } from '../../observability/poller-metrics/instrumentation.js';
import { detectThroughputAnomaly, MetricsCollector } from './MetricsCollector.js';
import { observabilityBus, ObservabilityBus } from './ObservabilityBus.js';
import { RateLimitTracker } from './RateLimitTracker.js';
import { RequestQueue } from './RequestQueue.js';
import { classifyRetryReason, getRetryBackoffMs, parseRetryAfterMs } from './RetryHandler.js';

function interpolatePath(template: string, pathParams: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(pathParams[key] ?? ''));
}

export class RiotGateway {
  private static instance: RiotGateway | null = null;

  private readonly queue = new RequestQueue();
  private readonly tracker = new RateLimitTracker();
  private readonly metrics = new MetricsCollector();
  private readonly startedAt = Date.now();
  private pendingFlushTimer: NodeJS.Timeout | null = null;
  private pendingFlushAt = 0;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;
  private activeDispatches = 0;
  private isFlushing = false;
  private lastDispatchAt = 0;
  private lastRpsCheckAt = Date.now();
  private readonly MIN_FLUSH_INTERVAL_MS = 100;

  private constructor() {
    const validation = validateConfig();
    if (!validation.valid) {
      gatewayLogger.fatal(
        { component: 'RiotGateway', event: 'invalid_config', reason: validation.fatalReason },
        'Invalid gateway configuration',
      );
      process.exit(1);
    }
    for (const warning of validation.warnings) {
      gatewayLogger.warn({ component: 'RiotGateway', event: 'config_warning', reason: warning }, warning);
    }

    gatewayLogger.info(
      {
        component: 'RiotGateway',
        event: 'gateway_ready',
        apiKeyType: riotConfig.apiKeyType,
        fallbackLimits: riotConfig.fallbackLimits[riotConfig.apiKeyType],
        maxConcurrency: riotConfig.maxConcurrency,
        safetyMargin: riotConfig.safetyMargin,
      },
      'Riot gateway ready',
    );

    this.metrics.startPeriodicSnapshot(
      5_000,
      this.tracker,
      () => this.queue.size(),
      () => this.tracker.getGlobalInFlight(),
    );
    this.startWatchdog();
  }

  static getInstance(): RiotGateway {
    if (!RiotGateway.instance) {
      RiotGateway.instance = new RiotGateway();
    }
    return RiotGateway.instance;
  }

  static async resetInstance(): Promise<void> {
    if (!RiotGateway.instance) return;
    await RiotGateway.instance.shutdown(0);
    RiotGateway.instance = null;
  }

  /** Test-only escape hatch */
  setSafetyMargin(margin: number): void {
    this.tracker.setSafetyMargin(margin);
  }

  async request<T>(
    baseUrl: string,
    path: string,
    pathParams: Record<string, string>,
    queryParams?: Record<string, string | number>,
    priority: RequestPriority = 'normal',
  ): Promise<GatewayResponse<T>> {
    if (this.shuttingDown) {
      throw new RiotShutdownError();
    }

    const methodKey = path;
    const resolvedPath = interpolatePath(path, pathParams);

    return new Promise<GatewayResponse<T>>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: crypto.randomUUID(),
        priority,
        methodKey,
        baseUrl,
        path: resolvedPath,
        queryParams,
        retries: 0,
        maxRetries: riotConfig.maxRetries,
        resolve: resolve as (value: GatewayResponse<T>) => void,
        reject,
        enqueuedAt: Date.now(),
        abortController: new AbortController(),
      };

      this.queue.enqueue(request);
      observabilityBus.emitEvent('request:enqueued', {
        requestId: request.id,
        priority,
        queueSize: this.queue.size(),
        highPriorityCount: this.queue.highPriorityCount(),
      });
      gatewayLogger.trace(
        {
          component: 'RequestQueue',
          event: 'enqueue',
          requestId: request.id,
          priority,
          queueSize: this.queue.size(),
          highPriorityCount: this.queue.highPriorityCount(),
        },
        'Request enqueued',
      );
      this.scheduleFlush('post_response', 0);
    });
  }

  getStatus(): GatewayStatus {
    const rps = this.metrics.getRPS();
    return {
      uptime_ms: Date.now() - this.startedAt,
      queue: { size: this.queue.size(), highPriority: this.queue.highPriorityCount() },
      inFlight: {
        global: this.tracker.getGlobalInFlight(),
        byMethod: Object.fromEntries(
          this.tracker.getAllBucketStates()
            .filter((bucket) => bucket.bucketId.startsWith('method:'))
            .reduce<Map<string, number>>((acc, bucket) => {
              const methodKey = bucket.bucketId.split(':')[1] ?? 'unknown';
              acc.set(methodKey, bucket.inFlight);
              return acc;
            }, new Map()),
        ),
      },
      buckets: this.tracker.getAllBucketStates(),
      metrics: {
        rps,
        latency: this.metrics.getLatencyPercentiles(),
        totals: this.metrics.getTotals(),
        tokenUtilization: this.metrics.getTokenUtilization(this.tracker),
      },
      config: {
        apiKeyType: riotConfig.apiKeyType,
        maxConcurrency: riotConfig.maxConcurrency,
        safetyMargin: this.tracker.getSafetyMargin(),
      },
    };
  }

  getObservabilityBus(): ObservabilityBus {
    return observabilityBus;
  }

  async shutdown(timeoutMs = 10_000): Promise<{ reason: ShutdownReason; flushed: number; rejected: number }> {
    if (this.shuttingDown) {
      return { reason: 'graceful', flushed: 0, rejected: 0 };
    }
    this.shuttingDown = true;
    observabilityBus.emitEvent('gateway:shutdown_start', { timeoutMs });
    gatewayLogger.info({ component: 'RiotGateway', event: 'gateway_shutdown_start', timeoutMs }, 'Gateway shutdown started');

    this.stopWatchdog();
    this.clearPendingFlushTimer();
    this.metrics.stop();

    const pending = this.queue.clear();
    for (const request of pending) {
      request.abortController.abort();
      request.reject(new RiotShutdownError());
    }

    const deadline = Date.now() + timeoutMs;
    while (this.tracker.getGlobalInFlight() > 0 && Date.now() < deadline) {
      await sleep(25);
    }

    const reason: ShutdownReason = this.tracker.getGlobalInFlight() > 0 ? 'timeout' : 'graceful';
    await closeAllPools();
    observabilityBus.emitEvent('gateway:shutdown_complete', { reason, rejected: pending.length });
    gatewayLogger.info(
      { component: 'RiotGateway', event: 'gateway_shutdown_complete', reason, rejected: pending.length },
      'Gateway shutdown complete',
    );
    return { reason, flushed: 0, rejected: pending.length };
  }

  private scheduleFlush(reason: FlushReason, waitMs = 0): void {
    if (waitMs <= 0) {
      setImmediate(() => this.flushQueue(reason));
      return;
    }
    this.scheduleFlushTimer(waitMs);
  }

  private scheduleFlushTimer(waitMs: number): void {
    const safeWaitMs = Math.max(this.MIN_FLUSH_INTERVAL_MS, waitMs);
    const fireAt = Date.now() + safeWaitMs;

    if (this.pendingFlushTimer && fireAt >= this.pendingFlushAt) {
      return;
    }

    this.clearPendingFlushTimer();

    this.pendingFlushTimer = setTimeout(() => {
      this.pendingFlushTimer = null;
      this.pendingFlushAt = 0;
      this.flushQueue('timer_expired');
    }, safeWaitMs);

    this.pendingFlushAt = fireAt;
  }

  private clearPendingFlushTimer(): void {
    if (this.pendingFlushTimer) {
      clearTimeout(this.pendingFlushTimer);
      this.pendingFlushTimer = null;
      this.pendingFlushAt = 0;
    }
  }

  private startWatchdog(): void {
    this.watchdogTimer = setInterval(() => {
      if (this.shuttingDown) return;

      const queueSize = this.queue.size();
      const inFlight = this.tracker.getTotalInFlight();
      const idleMs = this.lastDispatchAt > 0 ? Date.now() - this.lastDispatchAt : Number.POSITIVE_INFINITY;

      const flushAlreadyScheduled = this.pendingFlushTimer !== null;
      const queueBlocked =
        queueSize > 0 && inFlight === 0 && this.activeDispatches === 0 && idleMs > 2_000;

      if (queueBlocked && !flushAlreadyScheduled) {
        const buckets = this.tracker.getAllBucketStates();
        const payload = {
          queueSize,
          inFlight,
          inFlightByMethod: this.tracker.getInFlightByMethod(),
          idleMs,
          buckets: buckets.map((b) => ({
            id: b.bucketId,
            used: b.used,
            limit: b.limit,
            effectiveUsed: b.resetInMs === 0 ? 0 : b.used,
            available: b.available,
            resetInMs: b.resetInMs,
            saturatedUntil: b.saturatedUntil,
            isBlocked: b.isBlocked,
          })),
          pendingFlushTimer: false,
          pendingFlushAt: 0,
        };

        gatewayLogger.warn(
          { component: 'RiotGateway', event: 'watchdog_flush', ...payload },
          'watchdog: genuine stale queue — forcing flush',
        );
        observabilityBus.emitEvent('gateway:watchdog_triggered', payload);
        this.flushQueue('watchdog');
      } else if (queueBlocked && flushAlreadyScheduled) {
        gatewayLogger.trace(
          {
            component: 'RiotGateway',
            event: 'watchdog_skip',
            queueSize,
            inFlight,
            idleMs,
            pendingFlushInMs: Math.max(0, this.pendingFlushAt - Date.now()),
          },
          'watchdog: timer already scheduled, skipping',
        );
      }
    }, 1_000);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private flushQueue(reason: FlushReason): void {
    if (this.isFlushing) return;
    this.isFlushing = true;

    observabilityBus.emitEvent('queue:flush_attempt', { reason, queueSize: this.queue.size() });
    let dispatchedThisFlush = 0;

    const maxDispatchesPerFlush = riotConfig.maxDispatchesPerFlush;

    try {
    while (
      !this.queue.isEmpty() &&
      this.activeDispatches < riotConfig.maxConcurrency &&
      dispatchedThisFlush < maxDispatchesPerFlush
    ) {
      const peekMethodKey = this.queue.snapshot()[0]?.methodKey;
      if (!peekMethodKey) break;

      const check = this.tracker.canDispatch(peekMethodKey);
      if (!check.allowed) {
        this.scheduleFlushTimer(check.waitMs ?? 0);
        observabilityBus.emitEvent('queue:backpressure', {
          queueSize: this.queue.size(),
          waitMs: check.waitMs,
        });
        break;
      }

      const request = this.queue.dequeue();
      if (!request) break;

      gatewayLogger.trace(
        {
          component: 'RequestQueue',
          event: 'dequeue',
          requestId: request.id,
          priority: request.priority,
          queueSize: this.queue.size(),
          highPriorityCount: this.queue.highPriorityCount(),
        },
        'Request dequeued',
      );

      this.activeDispatches += 1;
      dispatchedThisFlush += 1;
      void this.dispatchRequest(request, reason);
    }

    gatewayLogger.debug(
      {
        component: 'RiotGateway',
        event: 'flush_complete',
        reason,
        dispatched: dispatchedThisFlush,
        remaining: this.queue.size(),
        inFlight: this.tracker.getTotalInFlight(),
      },
      'Queue flush completed',
    );

    if (this.queue.isEmpty()) {
      observabilityBus.emitEvent('queue:empty', {});
    }

    this.checkThroughputAnomaly();
    } finally {
      this.isFlushing = false;
    }
  }

  private async dispatchRequest(request: QueuedRequest, flushReason: FlushReason): Promise<void> {
    const queueWaitMs = Date.now() - request.enqueuedAt;
    const url = `${request.baseUrl.replace(/\/$/, '')}${request.path.startsWith('/') ? request.path : `/${request.path}`}`;

    gatewayLogger.debug(
      {
        component: 'RiotGateway',
        event: 'request_dispatched',
        requestId: request.id,
        methodKey: request.methodKey,
        url,
        queueWaitMs,
        inFlight: this.tracker.getGlobalInFlight(),
        inFlightMethod: this.tracker.getMethodInFlight(request.methodKey),
        appBuckets: this.tracker.getAppBucketStates(),
        methodBuckets: this.tracker.getMethodBucketStates(request.methodKey),
        flushReason,
      },
      'Request dispatched',
    );
    observabilityBus.emitEvent('request:dispatched', { requestId: request.id, methodKey: request.methodKey, url });

    this.tracker.incrementInFlight(request.methodKey);
    try {
      this.lastDispatchAt = Date.now();
      const response = await riotFetch(request.baseUrl, request.path, request.queryParams, request.abortController.signal);
      this.tracker.updateFromHeaders(request.methodKey, response.headers);

      if (response.statusCode === 429) {
        recordGatewayRequest({
          latencyMs: response.latencyMs,
          methodKey: request.methodKey,
          statusCode: 429,
          buckets: this.tracker.getAllBucketStates(),
        });
        await this.handle429(request, response.headers, url);
        return;
      }

      if (response.statusCode >= 500) {
        await this.handleRetry(request, '5xx', response.statusCode, url, response.body);
        return;
      }

      if (response.statusCode >= 400) {
        recordGatewayRequest({
          latencyMs: response.latencyMs,
          methodKey: request.methodKey,
          statusCode: response.statusCode,
          buckets: this.tracker.getAllBucketStates(),
        });
        this.metrics.record('error', response.latencyMs);
        request.reject(new RiotHttpError(response.statusCode, url, `Riot HTTP ${response.statusCode}`, response.body));
        observabilityBus.emitEvent('request:failed', { requestId: request.id, statusCode: response.statusCode });
        return;
      }

      this.metrics.record('success', response.latencyMs);
      recordGatewayRequest({
        latencyMs: response.latencyMs,
        methodKey: request.methodKey,
        statusCode: response.statusCode,
        buckets: this.tracker.getAllBucketStates(),
      });
      if (response.latencyMs > 3_000) {
        gatewayLogger.warn(
          {
            component: 'RiotGateway',
            event: 'latency_spike',
            requestId: request.id,
            methodKey: request.methodKey,
            latencyMs: response.latencyMs,
          },
          'Latency spike detected',
        );
      }

      const payload: GatewayResponse<unknown> = {
        data: response.body,
        statusCode: response.statusCode,
        requestId: request.id,
        latencyMs: response.latencyMs,
        headers: response.headers,
        rateLimitSnapshot: this.tracker.getAllBucketStates(),
      };

      gatewayLogger.info(
        {
          component: 'RiotGateway',
          event: 'request_success',
          requestId: request.id,
          methodKey: request.methodKey,
          url,
          statusCode: response.statusCode,
          latencyMs: response.latencyMs,
          remaining_tokens_app: this.tracker.getAppBucketStates().map((bucket) => ({
            window: bucket.windowMs,
            available: bucket.available,
          })),
          remaining_tokens_method: this.tracker.getMethodBucketStates(request.methodKey).map((bucket) => ({
            window: bucket.windowMs,
            available: bucket.available,
          })),
        },
        'Request succeeded',
      );
      observabilityBus.emitEvent('request:success', { requestId: request.id, statusCode: response.statusCode });
      request.resolve(payload);
    } catch (error) {
      if (error instanceof RiotNetworkError) {
        await this.handleRetry(request, 'network', 0, url, error);
        return;
      }
      if (error instanceof RiotHttpError) {
        this.metrics.record('error');
        request.abortController.abort();
      request.reject(error);
        observabilityBus.emitEvent('request:failed', { requestId: request.id, error: error.message });
        return;
      }
      this.metrics.record('error');
      request.reject(error);
      gatewayLogger.error(
        {
          component: 'RiotGateway',
          event: 'uncaught_queue_error',
          requestId: request.id,
          error: error instanceof Error ? error.stack : String(error),
          queueSize: this.queue.size(),
        },
        'Uncaught queue error',
      );
    } finally {
      this.tracker.decrementInFlight(request.methodKey);
      this.activeDispatches = Math.max(0, this.activeDispatches - 1);
      this.scheduleFlush('post_response', 0);
    }
  }

  private async handle429(request: QueuedRequest, headers: Record<string, string>, url: string): Promise<void> {
    const retryAfterMs = parseRetryAfterMs(headers);
    const includeApp = !headers['x-method-rate-limit'];
    recordSaturation({
      windowMs: includeApp ? 120_000 : 1_000,
      methodKey: includeApp ? 'app' : request.methodKey,
      waitMs: retryAfterMs,
    });
    this.tracker.saturate(request.methodKey, Date.now() + retryAfterMs, includeApp);
    this.metrics.record('429');
    observabilityBus.emitEvent('ratelimit:429', { requestId: request.id, retryAfterMs });

    gatewayLogger.warn(
      {
        component: 'RiotGateway',
        event: 'rate_limit_429',
        requestId: request.id,
        methodKey: request.methodKey,
        url,
        attempt: request.retries + 1,
        retryAfterMs,
        appBucketState: this.tracker.getAppBucketStates(),
        methodBucketState: this.tracker.getMethodBucketStates(request.methodKey),
      },
      'Rate limit 429 received',
    );

    await this.handleRetry(request, '429', 429, url, null, retryAfterMs + 50);
  }

  private async handleRetry(
    request: QueuedRequest,
    reason: RetryReason,
    statusCode: number,
    url: string,
    body: unknown,
    customBackoffMs?: number,
  ): Promise<void> {
    request.retries += 1;
    if (request.retries > request.maxRetries) {
      const error = new RiotMaxRetriesError(
        statusCode,
        url,
        `Max retries exceeded (${reason})`,
        request.retries,
        reason,
      );
      this.metrics.record('error');
      gatewayLogger.error(
        {
          component: 'RiotGateway',
          event: 'request_failed_max_retries',
          requestId: request.id,
          methodKey: request.methodKey,
          url,
          attempts: request.retries,
          finalError: { type: error.name, message: error.message, statusCode },
        },
        'Request failed after max retries',
      );
      request.abortController.abort();
      request.reject(error);
      observabilityBus.emitEvent('request:failed', { requestId: request.id, reason, attempts: request.retries });
      return;
    }

    const backoffMs = customBackoffMs ?? getRetryBackoffMs(request.retries);
    this.metrics.record('retry');
    gatewayLogger.warn(
      {
        component: 'RiotGateway',
        event: 'request_retrying',
        requestId: request.id,
        methodKey: request.methodKey,
        url,
        reason,
        attempt: request.retries,
        backoffMs,
        body,
      },
      'Request retry scheduled',
    );
    observabilityBus.emitEvent('request:retrying', { requestId: request.id, reason, attempt: request.retries, backoffMs });

    request.priority = 'high';
    request.lastAttemptAt = Date.now();
    this.queue.enqueue(request);
    this.scheduleFlush(reason === '429' ? 'retry_ready' : 'timer_expired', backoffMs);
  }

  private checkThroughputAnomaly(): void {
    const now = Date.now();
    if (now - this.lastRpsCheckAt < 5_000) return;
    this.lastRpsCheckAt = now;
    const rps = this.metrics.getRPS();
    if (detectThroughputAnomaly(rps.current, rps.avg60s)) {
      gatewayLogger.warn(
        {
          component: 'RiotGateway',
          event: 'throughput_anomaly',
          rps_current: rps.current,
          rps_avg_60s: rps.avg60s,
          queue_depth: this.queue.size(),
          in_flight: this.tracker.getGlobalInFlight(),
          token_utilization: this.metrics.getTokenUtilization(this.tracker),
        },
        'Throughput anomaly detected',
      );
    }
    if (this.queue.size() > 50) {
      gatewayLogger.warn(
        {
          component: 'MetricsCollector',
          event: 'queue_backpressure',
          queueSize: this.queue.size(),
          inFlight: this.tracker.getGlobalInFlight(),
          rps_current: rps.current,
          token_utilization: this.metrics.getTokenUtilization(this.tracker),
        },
        'Queue backpressure warning',
      );
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { classifyRetryReason };
