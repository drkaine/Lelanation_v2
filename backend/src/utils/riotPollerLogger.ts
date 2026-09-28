/**
 * Riot poller logger.
 * Console: errors/warnings always; info/step only if RIOT_POLLER_VERBOSE_LOGS=1.
 * Unified file log: always written for admin (see logs/lelanation-unified.log).
 */
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { formatLogArgs, logArgsJson } from '../logging/logArgs.js'

export type RiotPollerLogger = {
  info: (msg: string, ...args: unknown[]) => Promise<void>
  alerte: (msg: string, ...args: unknown[]) => Promise<void>
  error: (msg: string, ...args: unknown[]) => Promise<void>
  step: (step: string, details?: Record<string, unknown>) => Promise<void>
}

export function createRiotPollerLogger(script: string = 'poller'): RiotPollerLogger {
  const verbose = process.env.RIOT_POLLER_VERBOSE_LOGS === '1'
  const prefix = `[${script}]`
  return {
    async info(msg: string, ...rest: unknown[]) {
      // Unified log stays summary-oriented (30m / 1h summaries from poller processes).
      // Keep detailed info only on stdout when verbose mode is enabled.
      if (!verbose) return
      console.log(prefix, formatLogArgs(msg, rest))
    },
    async alerte(msg: string, ...rest: unknown[]) {
      const full = formatLogArgs(msg, rest)
      void appendUnifiedLog({
        section: 'back',
        type: 'warning',
        script,
        message: full,
        json: logArgsJson(rest),
      })
      console.warn(prefix, full)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = formatLogArgs(msg, rest)
      void appendUnifiedLog({
        section: 'back',
        type: 'erreur',
        script,
        message: full,
        json: logArgsJson(rest),
      })
      console.error(prefix, full)
    },
    async step(step: string, details?: Record<string, unknown>) {
      // Do not append step-by-step details to unified log by default.
      if (!verbose) return
      console.log(prefix, details ? `${step} | ${JSON.stringify(details)}` : step)
    },
  }
}
