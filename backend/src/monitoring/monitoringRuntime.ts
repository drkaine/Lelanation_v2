/**
 * Real I/O wiring for MonitoringService: unified log, JSON state file, Discord webhook, HTTP tracker.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { NextFunction, Request, Response } from 'express'
import { appendUnifiedLog, parseUnifiedLogLine, readUnifiedLogTail } from '../logging/unifiedAppLog.js'
import { postJson } from '../utils/httpFetch.js'
import type { RecapLogEntry } from './dailyRecap.js'
import { HttpErrorTracker } from './httpErrorTracker.js'
import { MonitoringService, type MonitoringState } from './MonitoringService.js'
import { gitHead, latestSourceMtimeMs, readProcessInfos } from './processFreshness.js'
import { CronStatusService } from '../services/CronStatusService.js'

/** ~24 h of unified log is ≈ 1.5 MB; keep margin for error bursts. */
const LOG_TAIL_BYTES = 8 * 1024 * 1024
const HTTP_WINDOW_MS = 5 * 60_000
const HTTP_LOG_THROTTLE_MS = 60_000

export const httpErrorTracker = new HttpErrorTracker({ windowMs: HTTP_WINDOW_MS, logThrottleMs: HTTP_LOG_THROTTLE_MS })

export function entriesSince(text: string, fromIso: string): RecapLogEntry[] {
  const lines = text.split(/\r?\n/)
  const out: RecapLogEntry[] = []
  for (let i = 0; i < lines.length; i++) {
    const p = parseUnifiedLogLine(lines[i], i + 1)
    if (!p || p.atIso < fromIso) continue
    out.push({ type: p.type, script: p.script, atIso: p.atIso, message: p.message, json: p.json })
  }
  return out
}

type RouteRequest = { method: string; baseUrl: string; path: string; route?: { path?: unknown } }

export function routeKey(req: RouteRequest): string {
  const pattern = typeof req.route?.path === 'string' ? `${req.baseUrl}${req.route.path}` : req.baseUrl + req.path
  const masked = pattern.replace(/\/\d+(?=\/|$)/g, '/:n').slice(0, 120)
  return `${req.method} ${masked || '/'}`
}

export function createJsonStateStore(file: string) {
  return {
    async load(): Promise<MonitoringState | null> {
      try {
        return JSON.parse(await readFile(file, 'utf-8')) as MonitoringState
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw e
      }
    },
    async save(state: MonitoringState): Promise<void> {
      await mkdir(dirname(file), { recursive: true })
      const tmp = `${file}.tmp`
      await writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8')
      await rename(tmp, file)
    },
  }
}

export function monitoringWebhookUrl(): string | null {
  return process.env.DISCORD_WEBHOOK_URL?.trim() || null
}

/** Express middleware: counts responses and logs 5xx (throttled) to the unified log. */
export function httpMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    const route = routeKey(req)
    const status = res.statusCode
    const { log, suppressed } = httpErrorTracker.record(route, status, Date.now())
    if (!log) return
    const error = typeof res.locals.errorMessage === 'string' ? res.locals.errorMessage.slice(0, 500) : undefined
    void appendUnifiedLog({
      section: 'back',
      type: 'erreur',
      script: 'http',
      message: `${route} → ${status}${error ? ` : ${error}` : ''}`,
      json: { route, status, suppressed, ...(error ? { error } : {}) },
    }).catch(() => undefined)
  })
  next()
}

let service: MonitoringService | null = null

export function getMonitoringService(): MonitoringService {
  if (service) return service
  const store = createJsonStateStore(join(process.cwd(), 'data', 'monitoring', 'state.json'))
  service = new MonitoringService({
    now: () => Date.now(),
    readLogEntries: async (fromIso) => entriesSince(await readUnifiedLogTail(LOG_TAIL_BYTES), fromIso),
    httpStats: () => httpErrorTracker.stats(Date.now()),
    loadState: () => store.load(),
    saveState: (s) => store.save(s),
    sendEmbed: async (embed) => {
      const url = monitoringWebhookUrl()
      if (!url) {
        console.warn('[Monitoring] No DISCORD_WEBHOOK_URL — not sent:', embed.title)
        return false
      }
      try {
        await postJson(
          url,
          { embeds: [{ ...embed, timestamp: new Date().toISOString(), footer: { text: 'Lelanation Monitoring' } }] },
          { timeoutMs: 10_000 }
        )
        return true
      } catch (error) {
        console.error('[Monitoring] Discord webhook failed:', error)
        return false
      }
    },
    appendLog: (type, message, json) =>
      appendUnifiedLog({ section: 'back', type, script: 'monitoring', message, json: json ?? null }),
    cronJobs: async () => {
      const status = await new CronStatusService().getStatus()
      return status.isOk() ? Object.values(status.unwrap().jobs) : []
    },
    uptimeMs: () => process.uptime() * 1000,
    processes: () => readProcessInfos(),
    codeVersion: async () => ({
      head: await gitHead(process.cwd()),
      latestSourceMtime: await latestSourceMtimeMs(join(process.cwd(), 'src')),
    }),
  })
  return service
}
