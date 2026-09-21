/**
 * Shared GET helper for /api/stats/*.
 *
 * Statistics pages fire dozens of requests on load and several watchers often ask for the very
 * same URL at the same time: identical concurrent GETs share one network request. Callers after
 * the first get their own copy of the payload, so in-place mutation by one consumer cannot leak
 * into another.
 */
type StatsFetchOptions = Parameters<typeof $fetch>[1]

const inflight = new Map<string, Promise<unknown>>()

export function statsFetch<T = unknown>(url: string, options?: StatsFetchOptions): Promise<T> {
  const opts = options as
    | { method?: string; body?: unknown; signal?: unknown; onResponse?: unknown }
    | undefined
  const method = String(opts?.method ?? 'GET').toUpperCase()
  // Anything that is not a plain GET, or that carries per-call callbacks/cancellation, is not shared.
  if (method !== 'GET' || opts?.body || opts?.signal || opts?.onResponse) {
    return $fetch(url, options) as Promise<T>
  }

  const existing = inflight.get(url)
  if (existing) return existing.then(data => structuredClone(data)) as Promise<T>

  const request = ($fetch(url, options) as Promise<T>).finally(() => {
    if (inflight.get(url) === request) inflight.delete(url)
  })
  inflight.set(url, request)
  return request
}
