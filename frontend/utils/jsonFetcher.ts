/**
 * Minimal fetcher accepted by stores and SSR helpers: `$fetch` on the client,
 * `useRequestFetch()` during SSR (forwards the incoming request headers).
 */
export type JsonFetcher = <T = unknown>(url: string, opts?: { cache?: RequestCache }) => Promise<T>
