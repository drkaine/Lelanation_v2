/**
 * Pure daily recap: errors/warnings from the unified log, poller totals and incidents over a period.
 */
import type { PollerWindowSummary } from './incidentRules.js'
import type { ActiveIncident, ResolvedIncident } from './incidentTracker.js'

export type RecapLogEntry = {
  type: string
  script: string
  atIso: string
  message: string
  json: Record<string, unknown> | null
}

export type RecapStatus = 'ok' | 'warning' | 'critical'

export type DailyRecap = {
  fromIso: string
  toIso: string
  status: RecapStatus
  errors: number
  warnings: number
  http5xx: number
  byScript: Array<{ script: string; errors: number; warnings: number }>
  topMessages: Array<{ script: string; type: string; message: string; count: number; lastAt: string }>
  poller: {
    windows: number
    requests: number
    count429: number
    matchesFetchedFailed: number
    matchesIngested: number
    matchesFailed: number
  }
  incidents: Array<{
    code: string
    severity: string
    title: string
    openedAt: string
    resolvedAt: string | null
    durationMin: number
  }>
}

export type DailyRecapInput = {
  fromIso: string
  toIso: string
  entries: RecapLogEntry[]
  summaries: PollerWindowSummary[]
  incidents: Array<ActiveIncident | ResolvedIncident>
}

const TOP_MESSAGES = 10
const ERROR_TYPE = 'erreur'
const WARNING_TYPE = 'warning'

function normalizeMessage(message: string): string {
  return message.replace(/\d+/g, '#').trim().slice(0, 200)
}

function resolvedAtOf(i: ActiveIncident | ResolvedIncident): string | null {
  return 'resolvedAt' in i ? i.resolvedAt : null
}

export function buildDailyRecap(input: DailyRecapInput): DailyRecap {
  const from = Date.parse(input.fromIso)
  const to = Date.parse(input.toIso)
  const inPeriod = (ms: number) => ms >= from && ms < to

  const byScript = new Map<string, { script: string; errors: number; warnings: number }>()
  const messages = new Map<string, DailyRecap['topMessages'][number]>()
  let errors = 0
  let warnings = 0
  let http5xx = 0

  for (const e of input.entries) {
    if (e.type !== ERROR_TYPE && e.type !== WARNING_TYPE) continue
    if (!inPeriod(Date.parse(e.atIso))) continue
    const isError = e.type === ERROR_TYPE
    const suppressed = e.json?.suppressed
    const weight = 1 + (typeof suppressed === 'number' && suppressed > 0 ? suppressed : 0)
    if (isError) errors += weight
    else warnings += weight
    const s = byScript.get(e.script) ?? { script: e.script, errors: 0, warnings: 0 }
    if (isError) s.errors += weight
    else s.warnings += weight
    byScript.set(e.script, s)
    if (e.script === 'http' && isError) http5xx += weight
    const key = `${e.script}|${e.type}|${normalizeMessage(e.message)}`
    const m = messages.get(key)
    if (!m) {
      messages.set(key, { script: e.script, type: e.type, message: e.message, count: weight, lastAt: e.atIso })
    } else {
      m.count += weight
      if (e.atIso >= m.lastAt) {
        m.lastAt = e.atIso
        m.message = e.message
      }
    }
  }

  const poller = { windows: 0, requests: 0, count429: 0, matchesFetchedFailed: 0, matchesIngested: 0, matchesFailed: 0 }
  for (const s of input.summaries) {
    if (!inPeriod(s.atMs)) continue
    poller.windows++
    poller.requests += s.requests
    poller.count429 += s.count429
    poller.matchesFetchedFailed += s.matchesFetchedFailed
    poller.matchesIngested += s.matchesIngested
    poller.matchesFailed += s.matchesFailed
  }

  const incidents = input.incidents
    .filter((i) => {
      const resolvedAt = resolvedAtOf(i)
      return Date.parse(i.openedAt) < to && (resolvedAt === null || Date.parse(resolvedAt) >= from)
    })
    .map((i) => {
      const resolvedAt = resolvedAtOf(i)
      const end = resolvedAt ? Date.parse(resolvedAt) : to
      return {
        code: i.code,
        severity: i.severity,
        title: i.title,
        openedAt: i.openedAt,
        resolvedAt,
        durationMin: Math.max(0, Math.round((end - Date.parse(i.openedAt)) / 60_000)),
      }
    })
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))

  const status: RecapStatus = incidents.some((i) => i.severity === 'critical')
    ? 'critical'
    : errors > 0 || incidents.length > 0
      ? 'warning'
      : 'ok'

  return {
    fromIso: input.fromIso,
    toIso: input.toIso,
    status,
    errors,
    warnings,
    http5xx,
    byScript: [...byScript.values()].sort((a, b) => b.errors - a.errors || b.warnings - a.warnings),
    topMessages: [...messages.values()]
      .sort((a, b) => Number(b.type === ERROR_TYPE) - Number(a.type === ERROR_TYPE) || b.count - a.count)
      .slice(0, TOP_MESSAGES),
    poller,
    incidents,
  }
}

export type RecapEmbed = {
  title: string
  description: string
  color: number
  fields: Array<{ name: string; value: string; inline?: boolean }>
}

const COLORS: Record<RecapStatus, number> = { ok: 0x2ecc71, warning: 0xf39c12, critical: 0xe74c3c }
const FIELD_MAX = 1024

function clampLines(lines: string[]): string {
  let out = ''
  for (const line of lines) {
    const next = out ? `${out}\n${line}` : line
    if (next.length > FIELD_MAX - 2) return out ? `${out}\n…` : `${line.slice(0, FIELD_MAX - 2)}…`
    out = next
  }
  return out || '—'
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })
}

export function recapToDiscordEmbed(r: DailyRecap): RecapEmbed {
  const title =
    r.status === 'ok'
      ? '✅ Récap quotidien — RAS'
      : r.status === 'critical'
        ? '🚨 Récap quotidien — incidents critiques'
        : '⚠️ Récap quotidien — erreurs à regarder'
  const p = r.poller
  const fields: RecapEmbed['fields'] = [
    {
      name: 'Ingestion (24 h)',
      value: clampLines([
        `Matchs ingérés : **${p.matchesIngested}** · échecs : ${p.matchesFailed}`,
        `Requêtes Riot : ${p.requests} · 429 : ${p.count429} · fetch KO : ${p.matchesFetchedFailed}`,
        `Fenêtres poller : ${p.windows}/144`,
      ]),
    },
    {
      name: 'Logs',
      value: `Erreurs : **${r.errors}** · warnings : ${r.warnings} · API 5xx : ${r.http5xx}`,
    },
  ]
  if (r.incidents.length > 0) {
    fields.push({
      name: `Incidents (${r.incidents.length})`,
      value: clampLines(
        r.incidents.map(
          (i) =>
            `${i.severity === 'critical' ? '🔴' : '🟠'} ${i.title} — ${hhmm(i.openedAt)} · ${i.durationMin} min${i.resolvedAt ? '' : ' (en cours)'}`
        )
      ),
    })
  }
  if (r.byScript.length > 0) {
    fields.push({
      name: 'Par source',
      value: clampLines(r.byScript.map((s) => `\`${s.script}\` : ${s.errors} err · ${s.warnings} warn`)),
    })
  }
  if (r.topMessages.length > 0) {
    fields.push({
      name: 'Messages les plus fréquents',
      value: clampLines(r.topMessages.map((m) => `×${m.count} \`${m.script}\` ${m.message.slice(0, 150)}`)),
    })
  }
  return {
    title,
    description: `Période : ${new Date(r.fromIso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} → ${new Date(r.toIso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
    color: COLORS[r.status],
    fields,
  }
}
