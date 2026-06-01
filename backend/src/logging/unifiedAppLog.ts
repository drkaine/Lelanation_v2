/**
 * Unified application log — single file, structured lines for admin UI.
 * Line format (tabs separate fields; message must not contain raw tabs):
 *   [section] [type] [script]    ISO8601    message    optionalJSON
 */
import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = join(__dirname, '..', '..')
export const DEFAULT_UNIFIED_LOG_PATH = join(BACKEND_ROOT, '..', 'logs', 'lelanation-unified.log')

const MAX_LOG_LINES = 50_000
const TRUNCATE_TO = 40_000

export type LogSection = 'back' | 'front' | 'db'
export type LogType =
  | 'debut'
  | 'fin'
  | 'erreur'
  | 'warning'
  | 'info'
  | 'rate_limit'
  | 'verification'
  | 'step'

export type UnifiedLogAppendInput = {
  section: LogSection
  type: LogType | string
  script: string
  message: string
  json?: Record<string, unknown> | null
  at?: Date
}

export type ParsedUnifiedLogEntry = {
  raw: string
  section: string
  type: string
  script: string
  atIso: string
  message: string
  json: Record<string, unknown> | null
  lineNumber: number
}

const HEADER_RE = /^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\]$/

function logPath(): string {
  const fromEnv = process.env.UNIFIED_LOG_PATH?.trim()
  if (fromEnv) return fromEnv
  return DEFAULT_UNIFIED_LOG_PATH
}

function normalizeMessage(msg: string): string {
  return msg.replace(/\r?\n/g, ' ').replace(/\t/g, ' ')
}

/** Serialize one log line (no trailing newline in return — caller adds \n) */
export function formatUnifiedLogLine(input: UnifiedLogAppendInput): string {
  const at = input.at ?? new Date()
  const iso = at.toISOString()
  const script = input.script.replace(/[^\w.-]/g, '_').slice(0, 64) || 'unknown'
  const jsonPart =
    input.json != null && Object.keys(input.json).length > 0 ? JSON.stringify(input.json) : ''
  const msg = normalizeMessage(input.message)
  return `[${input.section}] [${input.type}] [${script}]\t${iso}\t${msg}\t${jsonPart}`
}

/** Exported for poller metrics aggregation (admin). */
export function parseUnifiedLogLine(line: string, lineNumber: number): ParsedUnifiedLogEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const firstTab = trimmed.indexOf('\t')
  if (firstTab === -1) return null
  const header = trimmed.slice(0, firstTab)
  const rest = trimmed.slice(firstTab + 1)
  const hm = HEADER_RE.exec(header)
  if (!hm) return null
  const parts = rest.split('\t')
  if (parts.length < 2) return null
  const atIso = parts[0]
  const message = parts[1]
  const jsonStr = parts.slice(2).join('\t')
  let json: Record<string, unknown> | null = null
  if (jsonStr && jsonStr.trim().length > 0) {
    try {
      const parsed = JSON.parse(jsonStr) as unknown
      json = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { value: parsed }
    } catch {
      json = { _parseError: true, raw: jsonStr.slice(0, 2000) }
    }
  }
  return {
    raw: trimmed,
    section: hm[1],
    type: hm[2],
    script: hm[3],
    atIso,
    message,
    json,
    lineNumber,
  }
}

/** Read last `maxBytes` of unified log (avoids loading huge files for admin poller status). */
export async function readUnifiedLogTail(maxBytes = 4 * 1024 * 1024): Promise<string> {
  const file = logPath()
  let fh: Awaited<ReturnType<typeof fs.open>> | undefined
  try {
    fh = await fs.open(file, 'r')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw e
  }
  try {
    const st = await fh.stat()
    if (st.size === 0) return ''
    const readLen = Math.min(Number(st.size), maxBytes)
    const pos = Number(st.size) - readLen
    const buf = Buffer.alloc(readLen)
    await fh.read(buf, 0, readLen, pos)
    let s = buf.toString('utf-8')
    if (pos > 0) {
      const firstNl = s.indexOf('\n')
      if (firstNl !== -1) s = s.slice(firstNl + 1)
    }
    return s
  } finally {
    await fh.close()
  }
}

/** Inclure `poller_30m` / `poller_hourly` (très ancien poller in-process) dans les résumés admin. */
const POLLER_LEGACY_UNIFIED_LOG = process.env.ADMIN_POLLER_LEGACY_LOG_SCRIPTS === '1'
const POLLER_30M_SCRIPTS = POLLER_LEGACY_UNIFIED_LOG
  ? new Set(['poller_30m', 'poller_v3_30m'])
  : new Set(['poller_v3_30m'])
const POLLER_HOURLY_SCRIPTS = POLLER_LEGACY_UNIFIED_LOG
  ? new Set(['poller_hourly', 'poller_v3_1h'])
  : new Set(['poller_v3_1h'])

/** Derniers résumés 30m / horaire dans le log unifié (poller-metrics v3). */
export async function findLatestPollerSummaryEntries(): Promise<{
  last30m: ParsedUnifiedLogEntry | null
  lastHourly: ParsedUnifiedLogEntry | null
}> {
  const tail = await readUnifiedLogTail()
  if (!tail.trim()) return { last30m: null, lastHourly: null }
  const lines = tail.split(/\r?\n/)
  let last30m: ParsedUnifiedLogEntry | null = null
  let lastHourly: ParsedUnifiedLogEntry | null = null
  for (let i = lines.length - 1; i >= 0; i--) {
    const p = parseUnifiedLogLine(lines[i], i + 1)
    if (!p) continue
    if (POLLER_30M_SCRIPTS.has(p.script)) {
      if (!last30m || p.atIso > last30m.atIso) last30m = p
    }
    if (POLLER_HOURLY_SCRIPTS.has(p.script)) {
      if (!lastHourly || p.atIso > lastHourly.atIso) lastHourly = p
    }
  }
  return { last30m, lastHourly }
}

let appendChain: Promise<void> = Promise.resolve()

export async function appendUnifiedLog(input: UnifiedLogAppendInput): Promise<void> {
  const file = logPath()
  const line = formatUnifiedLogLine(input) + '\n'
  appendChain = appendChain.then(async () => {
    await fs.mkdir(dirname(file), { recursive: true })
    await fs.appendFile(file, line, 'utf-8')
    await rotateUnifiedLogIfNeeded(file)
  }).catch(() => undefined)
  return appendChain
}

async function rotateUnifiedLogIfNeeded(file: string): Promise<void> {
  try {
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

export type ReadUnifiedLogsOptions = {
  section?: string
  type?: string
  script?: string
  fromIso?: string
  toIso?: string
  search?: string
  sort?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export async function readUnifiedLogEntries(options: ReadUnifiedLogsOptions = {}): Promise<{
  entries: ParsedUnifiedLogEntry[]
  totalMatched: number
}> {
  const file = logPath()
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 5_000)
  const offset = Math.max(options.offset ?? 0, 0)
  const sort = options.sort ?? 'desc'

  let content: string
  try {
    content = await fs.readFile(file, 'utf-8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { entries: [], totalMatched: 0 }
    }
    throw e
  }

  const lines = content.split(/\r?\n/)
  const parsed: ParsedUnifiedLogEntry[] = []
  for (let i = 0; i < lines.length; i++) {
    const p = parseUnifiedLogLine(lines[i], i + 1)
    if (p) parsed.push(p)
  }

  let filtered = parsed
  if (options.section) {
    const s = options.section.toLowerCase()
    filtered = filtered.filter((e) => e.section.toLowerCase() === s)
  }
  if (options.type) {
    const t = options.type.toLowerCase()
    filtered = filtered.filter((e) => e.type.toLowerCase() === t)
  }
  if (options.script) {
    const sc = options.script.toLowerCase()
    filtered = filtered.filter((e) => e.script.toLowerCase() === sc)
  }
  if (options.fromIso) {
    const from = options.fromIso
    filtered = filtered.filter((e) => e.atIso >= from)
  }
  if (options.toIso) {
    const to = options.toIso
    filtered = filtered.filter((e) => e.atIso <= to)
  }
  if (options.search?.trim()) {
    const q = options.search.trim().toLowerCase()
    filtered = filtered.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        e.raw.toLowerCase().includes(q) ||
        (e.json && JSON.stringify(e.json).toLowerCase().includes(q))
    )
  }

  filtered.sort((a, b) =>
    sort === 'asc' ? a.atIso.localeCompare(b.atIso) : b.atIso.localeCompare(a.atIso)
  )

  const totalMatched = filtered.length
  const page = filtered.slice(offset, offset + limit)
  return { entries: page, totalMatched }
}

/** Remove lines whose timestamp falls in [fromIso, toIso] inclusive (ISO strings comparable). */
export async function deleteUnifiedLogsInRange(fromIso: string, toIso: string): Promise<{
  removed: number
  kept: number
}> {
  const file = logPath()
  let content: string
  try {
    content = await fs.readFile(file, 'utf-8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { removed: 0, kept: 0 }
    }
    throw e
  }
  const lines = content.split(/\r?\n/)
  let removed = 0
  let kept = 0
  const out: string[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    const p = parseUnifiedLogLine(line, 0)
    if (p && p.atIso >= fromIso && p.atIso <= toIso) {
      removed++
      continue
    }
    out.push(line)
  }
  kept = out.filter((l) => l.trim().length > 0).length
  await fs.mkdir(dirname(file), { recursive: true })
  await fs.writeFile(out.join('\n') + (out.length > 0 ? '\n' : ''), 'utf-8')
  return { removed, kept }
}

export function getUnifiedLogPathResolved(): string {
  return logPath()
}
