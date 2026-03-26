import type { ApiClientPort, StoragePort } from '@lelanation/front-core'
import { apiUrl } from '~/utils/apiUrl'

export const browserStoragePort: StoragePort = {
  getItem(key) {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // no-op
    }
  },
}

export const webApiPort: ApiClientPort = {
  async get<T>(path: string, options?: { timeoutMs?: number }) {
    const res = await fetch(apiUrl(path), {
      signal: options?.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} on GET ${path}`)
    }
    return (await res.json()) as T
  },
}
