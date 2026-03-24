/**
 * Riot poller logger.
 * Default mode is minimal (errors/warnings only) to keep backend logs clean.
 * Set RIOT_POLLER_VERBOSE_LOGS=1 to re-enable info/step debug logs.
 */

export type RiotPollerLogger = {
  info: (msg: string, ...args: unknown[]) => Promise<void>
  alerte: (msg: string, ...args: unknown[]) => Promise<void>
  error: (msg: string, ...args: unknown[]) => Promise<void>
  step: (step: string, details?: Record<string, unknown>) => Promise<void>
}

function formatMsg(msg: string, rest: unknown[]): string {
  return rest.length > 0
    ? `${msg} ${rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))).join(' ')}`
    : msg
}

export function createRiotPollerLogger(): RiotPollerLogger {
  const verbose = process.env.RIOT_POLLER_VERBOSE_LOGS === '1'
  return {
    async info(msg: string, ...rest: unknown[]) {
      if (!verbose) return
      console.log('[RiotPoller]', formatMsg(msg, rest))
    },
    async alerte(msg: string, ...rest: unknown[]) {
      const full = formatMsg(msg, rest)
      console.warn('[RiotPoller]', full)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = formatMsg(msg, rest)
      console.error('[RiotPoller]', full)
    },
    async step(step: string, details?: Record<string, unknown>) {
      if (!verbose) return
      console.log('[RiotPoller]', details ? `${step} | ${JSON.stringify(details)}` : step)
    },
  }
}
