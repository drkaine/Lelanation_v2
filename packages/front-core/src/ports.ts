import type { Build, StoredBuild, YouTubeChannelData, YouTubeChannelStatus } from '@lelanation/shared-types'

export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export interface ApiClientPort {
  get<T>(path: string, options?: { timeoutMs?: number }): Promise<T>
  post?<T>(path: string, body?: unknown): Promise<T>
  delete?<T>(path: string): Promise<T>
}

export interface RouterPort {
  replaceQuery(query: Record<string, string | undefined>): Promise<void> | void
}

export interface ClipboardPort {
  writeText(value: string): Promise<void>
}

export interface TelemetryPort {
  track(event: string, payload?: Record<string, unknown>): void
}

export interface BuildDiscoveryDataPort {
  getLocalBuilds(): Promise<Build[]> | Build[]
  getRemoteBuilds(): Promise<Array<Build | StoredBuild>>
}

export interface YouTubeDataPort {
  getStatus(): Promise<YouTubeChannelStatus[]>
  getChannelData(channelId: string): Promise<YouTubeChannelData | undefined>
}
