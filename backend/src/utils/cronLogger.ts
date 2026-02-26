/**
 * Logging for cron jobs - writes to logs/scripts/{cron}.log
 * Same format as ScriptLogger for consistency with admin script-logs API.
 */
import { promises as fs } from 'fs'
import { join } from 'path'

const LOG_DIR = join(process.cwd(), 'logs', 'scripts')
const MAX_LOG_LINES = 10_000
const TRUNCATE_TO = 8_000

function logFilePath(cron: string): string {
  const safe = cron.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(LOG_DIR, `${safe}.log`)
}

async function rotateIfNeeded(cron: string): Promise<void> {
  try {
    const file = logFilePath(cron)
    const content = await fs.readFile(file, 'utf-8').catch(() => '')
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length > MAX_LOG_LINES) {
      const kept = lines.slice(-TRUNCATE_TO).join('\n') + '\n'
      await fs.writeFile(file, kept, 'utf-8')
    }
  } catch {
    // ignore
  }
}

export type CronLogger = {
  info: (msg: string, ...args: unknown[]) => Promise<void>
  warn: (msg: string, ...args: unknown[]) => Promise<void>
  error: (msg: string, ...args: unknown[]) => Promise<void>
  step: (step: string, details?: Record<string, unknown>) => Promise<void>
}

export function createCronLogger(cron: string): CronLogger {
  const format = (msg: string, rest: unknown[]) =>
    rest.length > 0 ? `${msg} ${rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))).join(' ')}` : msg

  const append = async (level: string, message: string) => {
    await fs.mkdir(LOG_DIR, { recursive: true })
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
    await fs.appendFile(logFilePath(cron), line, 'utf-8')
    void rotateIfNeeded(cron)
  }

  return {
    async info(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.log(`[Cron ${cron}]`, full)
      await append('INFO', full)
    },
    async warn(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.warn(`[Cron ${cron}]`, full)
      await append('WARN', full)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.error(`[Cron ${cron}]`, full)
      await append('ERROR', full)
    },
    async step(step: string, details?: Record<string, unknown>) {
      const msg = details ? `${step} | ${JSON.stringify(details)}` : step
      console.log(`[Cron ${cron}]`, msg)
      await append('INFO', msg)
    },
  }
}
