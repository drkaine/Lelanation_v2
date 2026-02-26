/**
 * Centralized logging and status tracking for Riot scripts.
 * - Writes to logs/scripts/{script}.log
 * - Updates data/cron/riot-script-status.json (status, pid, timestamps)
 * - Handles crash/brutal shutdown: status → failed on uncaughtException/unhandledRejection
 *
 * Usage in scripts:
 *   const logger = createScriptLogger('riot:worker')
 *   logger.start()  // writes status running, registers exit handlers
 *   logger.info('message')
 *   logger.apiCall('getMatch', { count: 1, ok: true })
 *   // on exit: logger.end(0) or let process exit (logger catches and writes failed)
 */
import { promises as fs } from 'fs'
import { dirname, join } from 'path'

const LOG_DIR = join(process.cwd(), 'logs', 'scripts')
const STATUS_FILE = join(process.cwd(), 'data', 'cron', 'riot-script-status.json')
const MAX_LOG_LINES = 50_000
const TRUNCATE_TO = 40_000

type ScriptStatusValue = 'running' | 'stopped' | 'failed'
type ScriptStatusRow = {
  script: string
  status: ScriptStatusValue
  pid?: number
  args?: string[]
  lastStartAt?: string
  lastEndAt?: string
  lastExitCode?: number
  lastError?: string
}
type ScriptStatusMap = Record<string, ScriptStatusRow>

async function readStatusMap(): Promise<ScriptStatusMap> {
  try {
    const raw = await fs.readFile(STATUS_FILE, 'utf-8')
    const data = JSON.parse(raw) as ScriptStatusMap
    return data ?? {}
  } catch {
    return {}
  }
}

async function writeStatusMap(map: ScriptStatusMap): Promise<void> {
  await fs.mkdir(dirname(STATUS_FILE), { recursive: true })
  await fs.writeFile(STATUS_FILE, JSON.stringify(map, null, 0), 'utf-8')
}

async function updateStatus(script: string, patch: Partial<ScriptStatusRow>): Promise<void> {
  const map = await readStatusMap()
  const current = map[script] ?? { script, status: 'stopped' as ScriptStatusValue }
  map[script] = { ...current, ...patch, script }
  await writeStatusMap(map)
}

function logFilePath(script: string): string {
  const safe = script.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(LOG_DIR, `${safe}.log`)
}

async function appendLog(script: string, level: string, message: string): Promise<void> {
  await fs.mkdir(LOG_DIR, { recursive: true })
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
  await fs.appendFile(logFilePath(script), line, 'utf-8')
  void rotateIfNeeded(script)
}

async function rotateIfNeeded(script: string): Promise<void> {
  try {
    const file = logFilePath(script)
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
  script: string
  info: (msg: string, ...args: unknown[]) => Promise<void>
  warn: (msg: string, ...args: unknown[]) => Promise<void>
  error: (msg: string, ...args: unknown[]) => Promise<void>
  apiCall: (method: string, details: { count?: number; ok?: boolean; error?: string; [k: string]: unknown }) => Promise<void>
  jobResult: (job: string, details: { success: boolean; processed?: number; errors?: number; [k: string]: unknown }) => Promise<void>
  start: (args?: string[]) => Promise<void>
  end: (exitCode: number) => Promise<void>
}

export function createScriptLogger(script: string, args?: string[]): ScriptLogger {
  const format = (msg: string, rest: unknown[]) =>
    rest.length > 0 ? `${msg} ${rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))).join(' ')}` : msg

  let exitHandlersRegistered = false

  const registerExitHandlers = () => {
    if (exitHandlersRegistered) return
    exitHandlersRegistered = true

    const onExit = (code: number, _signal?: string) => {
      void updateStatus(script, {
        status: code === 0 ? 'stopped' : 'failed',
        lastEndAt: new Date().toISOString(),
        lastExitCode: code,
        pid: undefined,
      })
    }

    process.on('exit', (code) => {
      onExit(code ?? 0)
    })

    process.on('uncaughtException', (err) => {
      const msg = err instanceof Error ? err.message : String(err)
      void appendLog(script, 'ERROR', `uncaughtException: ${msg}`)
      void updateStatus(script, {
        status: 'failed',
        lastEndAt: new Date().toISOString(),
        lastError: msg,
        pid: undefined,
      })
    })

    process.on('unhandledRejection', (reason) => {
      const msg = reason instanceof Error ? reason.message : String(reason)
      void appendLog(script, 'ERROR', `unhandledRejection: ${msg}`)
      void updateStatus(script, {
        status: 'failed',
        lastEndAt: new Date().toISOString(),
        lastError: msg,
        pid: undefined,
      })
    })
  }

  return {
    script,
    async info(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.log(`[${script}]`, full)
      await appendLog(script, 'INFO', full)
    },
    async warn(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.warn(`[${script}]`, full)
      await appendLog(script, 'WARN', full)
    },
    async error(msg: string, ...rest: unknown[]) {
      const full = format(msg, rest)
      console.error(`[${script}]`, full)
      await appendLog(script, 'ERROR', full)
    },
    async apiCall(method: string, details: { count?: number; ok?: boolean; error?: string; [k: string]: unknown }) {
      const parts = [`API ${method}`, `count=${details.count ?? 1}`, `ok=${details.ok ?? false}`]
      if (details.error) parts.push(`error=${details.error}`)
      Object.entries(details).forEach(([k, v]) => {
        if (!['count', 'ok', 'error'].includes(k) && v != null) parts.push(`${k}=${JSON.stringify(v)}`)
      })
      await appendLog(script, 'INFO', parts.join(' | '))
    },
    async jobResult(job: string, details: { success: boolean; processed?: number; errors?: number; [k: string]: unknown }) {
      const parts = [`JOB ${job}`, `success=${details.success}`]
      if (details.processed != null) parts.push(`processed=${details.processed}`)
      if (details.errors != null) parts.push(`errors=${details.errors}`)
      Object.entries(details).forEach(([k, v]) => {
        if (!['success', 'processed', 'errors'].includes(k) && v != null) parts.push(`${k}=${JSON.stringify(v)}`)
      })
      await appendLog(script, 'INFO', parts.join(' | '))
    },
    async start(startArgs?: string[]) {
      registerExitHandlers()
      const pid = process.pid
      await updateStatus(script, {
        status: 'running',
        pid,
        args: startArgs ?? args,
        lastStartAt: new Date().toISOString(),
        lastEndAt: undefined,
        lastExitCode: undefined,
        lastError: undefined,
      })
      await appendLog(script, 'INFO', `START pid=${pid} args=${JSON.stringify(startArgs ?? args ?? [])}`)
    },
    async end(exitCode: number) {
      await updateStatus(script, {
        status: exitCode === 0 ? 'stopped' : 'failed',
        lastEndAt: new Date().toISOString(),
        lastExitCode: exitCode,
        pid: undefined,
      })
      await appendLog(script, 'INFO', `END exit=${exitCode}`)
    },
  }
}
