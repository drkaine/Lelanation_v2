import crypto from 'node:crypto'
import { Dispatcher } from './Dispatcher.js'
import { RequestQueue } from './RequestQueue.js'
import { SlidingWindowCounter } from './SlidingWindowCounter.js'
import { RiotHttpClient, type RiotHttpResponse } from './RiotHttpClient.js'
import type { DispatcherConfig, GatewayRequest, RateLimitState, RiotRegion } from './types.js'

const RIOT_API_KEY_ENV = 'RIOT_API_KEY'

const DEFAULT_CONFIG: DispatcherConfig = {
  targetRpm: 96,
  windowMs: 120_000,
  tickIntervalMs: 1_250,
  safetyBuffer: 4,
}

function resolveApiKey(providedApiKey?: string): string {
  const key = providedApiKey?.trim() || process.env[RIOT_API_KEY_ENV]?.trim()
  if (!key) throw new Error('No RIOT_API_KEY in env')
  return key
}

export class RateLimitGateway {
  private static instance: RateLimitGateway | null = null

  private readonly queue = new RequestQueue<unknown>()
  private readonly counter: SlidingWindowCounter
  private readonly client: RiotHttpClient
  private readonly dispatcher: Dispatcher
  private latestRateLimitState: RateLimitState | null = null
  private http429Count = 0

  private constructor(apiKey: string, config?: Partial<DispatcherConfig>) {
    const finalConfig: DispatcherConfig = { ...DEFAULT_CONFIG, ...config }
    this.counter = new SlidingWindowCounter(finalConfig.windowMs)
    this.client = new RiotHttpClient(apiKey)
    this.dispatcher = new Dispatcher(
      this.queue,
      this.counter,
      this.client,
      finalConfig,
      {
        onRateLimitState: (state) => {
          this.latestRateLimitState = state
        },
        on429: () => {
          this.http429Count += 1
        },
      }
    )
    this.dispatcher.start()
  }

  static getInstance(apiKey?: string, config?: Partial<DispatcherConfig>): RateLimitGateway {
    const resolvedKey = resolveApiKey(apiKey)
    if (!RateLimitGateway.instance) {
      RateLimitGateway.instance = new RateLimitGateway(resolvedKey, config)
      return RateLimitGateway.instance
    }
    RateLimitGateway.instance.client.setApiKey(resolvedKey)
    return RateLimitGateway.instance
  }

  async execute<T>(
    region: RiotRegion,
    path: string,
    params: Record<string, string>
  ): Promise<T> {
    const res = await this.executeWithMeta<T>(region, path, params)
    return res.data
  }

  async executeWithMeta<T>(
    region: RiotRegion,
    path: string,
    params: Record<string, string>
  ): Promise<RiotHttpResponse<T>> {
    return new Promise<RiotHttpResponse<T>>((resolve, reject) => {
      const req: GatewayRequest<RiotHttpResponse<T>> = {
        id: crypto.randomUUID(),
        region,
        path,
        params,
        resolve,
        reject,
        enqueuedAt: Date.now(),
        attempts: 0,
      }
      this.queue.enqueue(req as unknown as GatewayRequest<unknown>)
    })
  }

  getStats(): {
    queueSize: number
    windowCount: number
    lastSync: number
    http429Count: number
  } {
    return {
      queueSize: this.queue.size(),
      windowCount: this.counter.count(),
      lastSync: this.latestRateLimitState?.lastSyncAt ?? this.counter.getLastSyncAt(),
      http429Count: this.http429Count,
    }
  }

  gracefulShutdown(reason = 'Gateway stopped'): void {
    this.dispatcher.stop()
    const pending = this.queue.drain()
    const error = new Error(reason)
    for (const req of pending) req.reject(error)
  }

  stop(): void {
    this.gracefulShutdown('Gateway stopped')
  }
}
