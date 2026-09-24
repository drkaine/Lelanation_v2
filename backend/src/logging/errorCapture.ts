/**
 * Forwards process errors (console.error + pino error/fatal) to the unified log, throttled,
 * so the admin monitoring and the daily recap see errors that used to live only in PM2 logs.
 */
import { format } from 'node:util'
import type { LoggerOptions } from 'pino'
import { appendUnifiedLog } from './unifiedAppLog.js'

export type ErrorSource = 'console' | 'pino'
export type ErrorDetails = Record<string, string | number | boolean>
export type CapturedError = {
  script: string
  message: string
  source: ErrorSource
  suppressed: number
  details?: ErrorDetails
}
export type ErrorForwarder = (message: string, source: ErrorSource, details?: ErrorDetails) => void

const PINO_ERROR_LEVEL = 50
const MESSAGE_MAX = 1000

export function createErrorForwarder(opts: {
  script: string
  throttleMs: number
  now: () => number
  append: (e: CapturedError) => void
}): ErrorForwarder {
  const last = new Map<string, { atMs: number; suppressed: number }>()
  return (message, source, details) => {
    const nowMs = opts.now()
    const key = `${source}|${message.replace(/\d+/g, '#').slice(0, 200)}`
    const prev = last.get(key)
    if (prev && nowMs - prev.atMs < opts.throttleMs) {
      prev.suppressed++
      return
    }
    last.set(key, { atMs: nowMs, suppressed: 0 })
    if (last.size > 500) last.delete(last.keys().next().value as string)
    opts.append({
      script: opts.script,
      message: message.slice(0, MESSAGE_MAX),
      source,
      suppressed: prev?.suppressed ?? 0,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    })
  }
}

function errorText(v: unknown): string | null {
  if (v instanceof Error) return v.message
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    for (const k of ['err', 'error']) {
      const inner = o[k]
      if (inner instanceof Error) return inner.message
      if (typeof inner === 'string') return inner
    }
  }
  return null
}

export function pinoArgsToMessage(args: unknown[]): string {
  const [first, second] = args
  if (typeof first === 'string') return format(...(args as [string, ...unknown[]]))
  const err = errorText(first)
  if (typeof second === 'string') return err ? `${second}: ${err}` : second
  return err ?? format(first)
}

const DETAILS_MAX_KEYS = 12
const DETAILS_SKIP_KEYS = new Set(['err', 'error', 'msg', 'level', 'time', 'pid', 'hostname'])

/** Scalar context fields of a pino call (e.g. operation, p95_ms), for diagnosis in the unified log. */
export function pinoArgsToDetails(args: unknown[]): ErrorDetails | undefined {
  const [first] = args
  if (typeof first !== 'object' || first === null || first instanceof Error) return undefined
  const details: ErrorDetails = {}
  for (const [key, value] of Object.entries(first)) {
    if (DETAILS_SKIP_KEYS.has(key)) continue
    if (typeof value === 'string') details[key] = value.slice(0, 200)
    else if (typeof value === 'number' || typeof value === 'boolean') details[key] = value
    if (Object.keys(details).length >= DETAILS_MAX_KEYS) break
  }
  return Object.keys(details).length > 0 ? details : undefined
}

let currentForwarder: ErrorForwarder | null = null

export function setErrorForwarder(forward: ErrorForwarder | null): void {
  currentForwarder = forward
}

/** Add to every pino logger: forwards error/fatal lines once a process installed a forwarder. */
export const errorCaptureHooks: NonNullable<LoggerOptions['hooks']> = {
  logMethod(inputArgs, method, level) {
    if (currentForwarder && level >= PINO_ERROR_LEVEL) {
      try {
        currentForwarder(pinoArgsToMessage(inputArgs), 'pino', pinoArgsToDetails(inputArgs))
      } catch {
        // never break logging
      }
    }
    return method.apply(this, inputArgs)
  },
}

export function installConsoleErrorCapture(
  forward: ErrorForwarder,
  target: { error: (...args: unknown[]) => void } = console
): () => void {
  const original = target.error
  target.error = (...args: unknown[]) => {
    original.apply(target, args)
    try {
      forward(format(...args), 'console')
    } catch {
      // never break logging
    }
  }
  return () => {
    target.error = original
  }
}

/** Process entry point helper: console.error + pino errors → unified log (`erreur`, script = process name). */
export function installProcessErrorCapture(script: string): void {
  const forward = createErrorForwarder({
    script,
    throttleMs: 60_000,
    now: () => Date.now(),
    append: (e) => {
      void appendUnifiedLog({
        section: 'back',
        type: 'erreur',
        script: e.script,
        message: e.message,
        json: {
          source: e.source,
          ...(e.suppressed > 0 ? { suppressed: e.suppressed } : {}),
          ...(e.details ?? {}),
        },
      }).catch(() => undefined)
    },
  })
  setErrorForwarder(forward)
  installConsoleErrorCapture(forward)
}
