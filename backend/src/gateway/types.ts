export type RiotRegion =
  | 'euw1'
  | 'eun1'
  | 'na1'
  | 'kr'
  | 'br1'
  | 'jp1'
  | 'la1'
  | 'la2'
  | 'oc1'
  | 'ru'
  | 'tr1'
  | 'europe'
  | 'americas'
  | 'asia'
  | (string & {})

export interface GatewayRequest<T = unknown> {
  id: string
  region: RiotRegion
  path: string
  params: Record<string, string>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
  enqueuedAt: number
  attempts: number
}

export interface RateLimitState {
  appLimit: number
  appCount: number
  windowMs: number
  lastSyncAt: number
  windowStartAt: number
}

export interface MethodRateLimitState {
  path: string
  limit: number
  count: number
  windowMs: number
  lastSyncAt: number
}

export interface DispatcherConfig {
  targetRpm: number
  windowMs: number
  tickIntervalMs: number
  safetyBuffer: number
}
