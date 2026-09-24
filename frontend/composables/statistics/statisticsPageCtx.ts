import { inject } from 'vue'

/**
 * Statistics pages expose their setup state to tab components through a Proxy
 * (`provide('statisticsPageCtx', …)`) that unwraps refs one level.
 * Each consumer declares the slice it reads as a typed interface.
 */
export const STATISTICS_PAGE_CTX_KEY = 'statisticsPageCtx'

export type StatisticsT = (key: string, named?: Record<string, unknown>) => string

export function injectStatisticsPageCtx<T extends object>(): T {
  const ctx = inject<T | null>(STATISTICS_PAGE_CTX_KEY, null)
  if (!ctx) throw new Error('statisticsPageCtx is not provided')
  return ctx
}
