/**
 * Riot poller logger.
 * Console: errors/warnings always; info/step only if RIOT_POLLER_VERBOSE_LOGS=1.
 * Unified file log: always written for admin (see logs/lelanation-unified.log).
 */
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'

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

function restToJson(rest: unknown[]): Record<string, unknown> | null {
  if (rest.length === 0) return null
  if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null && !Array.isArray(rest[0])) {
    return rest[0] as Record<string, unknown>
  }
  return { details: rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))) }
}

export function createRiotPollerLogger(script: string = 'poller'): RiotPollerLogger {
  const verbose = process.env.RIOT_POLLER_VERBOSE_LOGS === '1'
  const prefix = `[${script}]`
  return {
    async info(msg: string, ...rest: unknown[]) {
      void appendUnifiedLog({
        section: 'back',
        type: 'info',
        script,
        message: formatMsg(msg, rest),
        json: restToJson(rest),
      })
      if (!verbose) return
      console.log(prefix, formatMsg(msg, rest))
    },
    async alerte(msg: string, ...rest: unknown[]) {
      const full = formatMsg(msg, rest)
      void appendUnifiedLog({
        section: 'back',
        type: 'warning',
        script,
        message: full,
        json: restToJson(rest),
      })
      console.warn(prefix, full)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = formatMsg(msg, rest)
      void appendUnifiedLog({
        section: 'back',
        type: 'erreur',
        script,
        message: full,
        json: restToJson(rest),
      })
      console.error(prefix, full)
    },
    async step(step: string, details?: Record<string, unknown>) {
      void appendUnifiedLog({
        section: 'back',
        type: 'step',
        script,
        message: details ? `${step} | ${JSON.stringify(details)}` : step,
        json: details ?? null,
      })
      if (!verbose) return
      console.log(prefix, details ? `${step} | ${JSON.stringify(details)}` : step)
    },
  }
}
