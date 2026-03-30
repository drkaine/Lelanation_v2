/**
 * Cron jobs: unified log only (single file) + console for warn/error.
 */
import { appendUnifiedLog, type LogType } from '../logging/unifiedAppLog.js'

const CRON_TO_SCRIPT: Record<string, string> = {
  dataDragonSync: 'datadragon',
  youtubeSync: 'youtube',
  communityDragonSync: 'community_dragon',
}

function scriptForCron(cron: string): string {
  return CRON_TO_SCRIPT[cron] ?? cron.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)
}

export type CronLogger = {
  info: (msg: string, ...args: unknown[]) => Promise<void>
  warn: (msg: string, ...args: unknown[]) => Promise<void>
  error: (msg: string, ...args: unknown[]) => Promise<void>
  step: (step: string, details?: Record<string, unknown>) => Promise<void>
}

function format(msg: string, rest: unknown[]): string {
  return rest.length > 0 ? `${msg} ${rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))).join(' ')}` : msg
}

function restToJson(rest: unknown[]): Record<string, unknown> | null {
  if (rest.length === 0) return null
  if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null && !Array.isArray(rest[0])) {
    return rest[0] as Record<string, unknown>
  }
  return { details: rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))) }
}

export function createCronLogger(cron: string): CronLogger {
  const script = scriptForCron(cron)

  const write = async (level: LogType, message: string, rest: unknown[]) => {
    await appendUnifiedLog({
      section: 'back',
      type: level,
      script,
      message,
      json: restToJson(rest),
    })
  }

  return {
    async info(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      await write('info', full, rest)
    },
    async warn(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.warn(`[Cron ${cron}]`, full)
      await write('warning', full, rest)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.error(`[Cron ${cron}]`, full)
      await write('erreur', full, rest)
    },
    async step(step: string, details?: Record<string, unknown>) {
      const msg = details ? `${step} | ${JSON.stringify(details)}` : step
      await appendUnifiedLog({
        section: 'back',
        type: 'step',
        script,
        message: msg,
        json: details ?? null,
      })
    },
  }
}
