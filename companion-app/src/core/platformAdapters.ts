import type { ApiClientPort, StoragePort } from '@lelanation/front-core'
import { apiBase } from '../config'

export const companionStoragePort: StoragePort = {
  getItem(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // no-op
    }
  },
}

export const companionApiPort: ApiClientPort = {
  async get<T>(path: string, options?: { timeoutMs?: number }) {
    const res = await fetch(`${apiBase}${path}`, {
      signal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on GET ${path}`)
    }
    return (await res.json()) as T
  },
}
