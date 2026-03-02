/**
 * Logging for scripts - writes to logs/scripts/{scriptId}.log
 * Same format as admin script-logs API: [timestamp] [LEVEL] message
 */
import { promises as fs } from 'fs'
import { join } from 'path'

const LOG_DIR = join(process.cwd(), 'logs', 'scripts')
const MAX_LOG_LINES = 10_000
const TRUNCATE_TO = 8_000

function logFilePath(scriptId: string): string {
  const safe = scriptId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(LOG_DIR, `${safe}.log`)
}

async function rotateIfNeeded(scriptId: string): Promise<void> {
  try {
    const file = logFilePath(scriptId)
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

export type ScriptLogger = {
  start: (args: string[]) => Promise<void>
  info: (msg: string, ...args: unknown[]) => Promise<void>
  warn: (msg: string, ...args: unknown[]) => Promise<void>
  error: (msg: string, ...args: unknown[]) => Promise<void>
  jobResult: (job: string, details: Record<string, unknown>) => Promise<void>
  end: (exitCode: number) => Promise<void>
}

function format(msg: string, rest: unknown[]): string {
  return rest.length > 0 ? `${msg} ${rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))).join(' ')}` : msg
}

async function append(scriptId: string, level: string, message: string): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true })
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
  await fs.appendFile(logFilePath(scriptId), line, 'utf-8')
  void rotateIfNeeded(scriptId)
}

export function createScriptLogger(scriptId: string): ScriptLogger {
  return {
    async start(args: string[]) {
      const msg = `START args=${JSON.stringify(args)}`
      console.log(`[${scriptId}]`, msg)
      await append(scriptId, 'INFO', msg)
    },
    async info(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.log(`[${scriptId}]`, full)
      await append(scriptId, 'INFO', full)
    },
    async warn(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.warn(`[${scriptId}]`, full)
      await append(scriptId, 'WARN', full)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.error(`[${scriptId}]`, full)
      await append(scriptId, 'ERROR', full)
    },
    async jobResult(job: string, details: Record<string, unknown>) {
      const msg = `JOB_RESULT ${job} ${JSON.stringify(details)}`
      console.log(`[${scriptId}]`, msg)
      await append(scriptId, 'INFO', msg)
    },
    async end(exitCode: number) {
      const msg = `END exit=${exitCode}`
      console.log(`[${scriptId}]`, msg)
      await append(scriptId, 'INFO', msg)
    },
  }
}
