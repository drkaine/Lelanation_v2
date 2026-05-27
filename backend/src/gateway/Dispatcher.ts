import { parseRateLimitHeaders } from './HeaderParser.js'
import { RequestQueue } from './RequestQueue.js'
import { SlidingWindowCounter } from './SlidingWindowCounter.js'
import { RiotHttpClient } from './RiotHttpClient.js'
import type { DispatcherConfig, GatewayRequest, RateLimitState } from './types.js'

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
    try {
      const response = await this.client.fetch(req.region, req.path, req.params)
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
      }

      if (response.status >= 200 && response.status < 300) {
        this.counter.add()
        req.resolve(response as unknown)
        return
      }

      if (response.status === 429) {
        this.hooks.on429?.()
        this.queue.enqueueFront(req)
        this.pauseForRetryAfter(parseRetryAfterMs(response.headers))
        return
      }

      if (response.status >= 500) {
        req.attempts += 1
        if (req.attempts < 3) {
          this.queue.enqueueFront(req)
          return
        }
        req.reject(new Error(`Riot API ${response.status} after ${req.attempts} attempts`))
        return
      }

      req.reject(new Error(`Riot API request failed with status ${response.status}`))
    } catch (error) {
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
