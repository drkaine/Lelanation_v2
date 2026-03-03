/**
 * Logger for the Riot poller: writes to logs/riot-poller.log
 * Format: [YYYY-MM-DD HH:mm:ss] [INFO|ALERTE|ERROR] message
 * Uses local time (timezone H+1 / Europe/Paris for consistency with spec).
 */
import { promises as fs } from 'fs'
import { join } from 'path'

const LOG_FILE = join(process.cwd(), 'logs', 'riot-poller.log')
const MAX_LINES = 50000
const TRUNCATE_TO = 40000

function formatTimestamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

async function append(level: string, message: string): Promise<void> {
  const dir = join(process.cwd(), 'logs')
  await fs.mkdir(dir, { recursive: true })
  const line = `[${formatTimestamp()}] [${level}] ${message}\n`
  await fs.appendFile(LOG_FILE, line, 'utf-8')
  void rotateIfNeeded()
}

async function rotateIfNeeded(): Promise<void> {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf-8').catch(() => '')
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (lines.length > MAX_LINES) {
      const kept = lines.slice(-TRUNCATE_TO).join('\n') + '\n'
      await fs.writeFile(LOG_FILE, kept, 'utf-8')
    }
  } catch {
    // ignore
  }
}

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
  return {
    async info(msg: string, ...rest: unknown[]) {
      const full = formatMsg(msg, rest)
      console.log('[RiotPoller]', full)
      await append('INFO', full)
    },
    async alerte(msg: string, ...rest: unknown[]) {
      const full = formatMsg(msg, rest)
      console.warn('[RiotPoller]', full)
      await append('ALERTE', full)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = formatMsg(msg, rest)
      console.error('[RiotPoller]', full)
      await append('ERROR', full)
    },
    async step(step: string, details?: Record<string, unknown>) {
      const msg = details ? `${step} | ${JSON.stringify(details)}` : step
      console.log('[RiotPoller]', msg)
      await append('INFO', msg)
    },
  }
}
