import { parseRateLimitHeaders } from './HeaderParser.js'
import { RequestQueue } from './RequestQueue.js'
import { SlidingWindowCounter } from './SlidingWindowCounter.js'
import { RiotHttpClient } from './RiotHttpClient.js'
import type { DispatcherConfig, GatewayRequest, RateLimitState } from './types.js'
import { metrics } from '../observability/MetricsCollector.js'

type DispatcherHooks = {
  onRateLimitState?: (state: RateLimitState) => void
  on429?: () => void
}

const DEFAULT_RETRY_AFTER_MS = 1_000

function parseRetryAfterMs(headers: Headers): number {
  const raw = headers.get('retry-after')
  const sec = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(sec) || sec <= 0) return DEFAULT_RETRY_AFTER_MS
  return sec * 1_000
}

export class Dispatcher {
  private timer: NodeJS.Timeout | null = null
  private resumeTimer: NodeJS.Timeout | null = null
  private isDispatching = false

  constructor(
    private readonly queue: RequestQueue,
    private readonly counter: SlidingWindowCounter,
    private readonly client: RiotHttpClient,
    private readonly config: DispatcherConfig,
    private readonly hooks: DispatcherHooks = {}
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.tick()
    }, this.config.tickIntervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer)
      this.resumeTimer = null
    }
  }

  async tick(): Promise<void> {
    metrics.recordQueueDepth({ stage: 'Gateway', depth: this.queue.size() })
    if (this.isDispatching) return
    if (this.queue.isEmpty()) return
    if (!this.counter.canSend(this.config.targetRpm)) return

    this.isDispatching = true
    try {
      const req = this.queue.dequeue()
      if (!req) return
      await this.dispatch(req)
    } finally {
      this.isDispatching = false
    }
  }

  private async dispatch(req: GatewayRequest): Promise<void> {
    const startedAt = Date.now()
    try {
      const response = await this.client.fetch(req.region, req.path, req.params)
      const durationMs = Date.now() - startedAt
      const parsed = parseRateLimitHeaders(response.headers)
      if (
        parsed.appLimit != null &&
        parsed.appCount != null &&
        parsed.windowMs != null &&
        parsed.lastSyncAt != null &&
        parsed.windowStartAt != null
      ) {
        this.counter.syncFromHeaders(parsed as RateLimitState)
        this.hooks.onRateLimitState?.(parsed as RateLimitState)
        metrics.recordHeaderSync({
          appCount: parsed.appCount,
          appLimit: parsed.appLimit,
          windowMs: parsed.windowMs,
        })
      }

      metrics.recordRequest({
        region: req.region,
        path: req.path,
        status: response.status,
        durationMs,
        windowCount: parsed.appCount ?? 0,
        windowLimit: parsed.appLimit ?? 100,
      })

      if (response.status >= 200 && response.status < 300) {
        this.counter.add()
        metrics.recordStageItem({ stage: 'Gateway', success: true, durationMs })
        req.resolve(response as unknown)
        return
      }

      if (response.status === 429) {
        const retryAfterMs = parseRetryAfterMs(response.headers)
        this.hooks.on429?.()
        metrics.record429({
          region: req.region,
          path: req.path,
          retryAfterMs,
        })
        metrics.recordStageItem({ stage: 'Gateway', success: false, durationMs })
        this.queue.enqueueFront(req)
        this.pauseForRetryAfter(retryAfterMs)
        return
      }

      if (response.status >= 500) {
        metrics.recordStageItem({ stage: 'Gateway', success: false, durationMs })
        req.attempts += 1
        if (req.attempts < 3) {
          this.queue.enqueueFront(req)
          return
        }
        req.reject(new Error(`Riot API ${response.status} after ${req.attempts} attempts`))
        return
      }

      metrics.recordStageItem({ stage: 'Gateway', success: false, durationMs })
      req.reject(new Error(`Riot API request failed with status ${response.status}`))
    } catch (error) {
      const durationMs = Date.now() - startedAt
      metrics.recordStageItem({ stage: 'Gateway', success: false, durationMs })
      metrics.recordError({
        stage: 'Gateway',
        error: error instanceof Error ? error : new Error(String(error)),
        context: { path: req.path, region: req.region },
      })
      req.attempts += 1
      if (req.attempts < 3) {
        this.queue.enqueueFront(req)
        return
      }
      req.reject(error)
    }
  }

  private pauseForRetryAfter(retryAfterMs: number): void {
    this.stop()
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null
      this.start()
    }, retryAfterMs)
  }
}
