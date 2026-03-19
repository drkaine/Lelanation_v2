import 'dotenv/config'

type ScriptStatusResponse = {
  activeScript: string | null
  isRunning: boolean
  startedAt: string | null
  finishedAt: string | null
  lastError: string | null
  shouldStop: boolean
  counters: Record<string, unknown>
  lastFinishedScript?: string | null
  lastFinishedAt?: string | null
}

function buildBaseUrlFromEnvOrPort(): string {
  const fromEnv = process.env.ADMIN_API_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  const port = process.env.PORT?.trim() || '3001'
  return `http://localhost:${port}/api/admin`
}

function authHeader(): Record<string, string> {
  const user = process.env.ADMIN_USER_NAME ?? process.env.ADMIN_USERNAME
  const pass = process.env.ADMIN_PASSWORD
  if (!user || !pass) return {}
  const token = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64')
  return { Authorization: `Basic ${token}` }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|socket hang up/i.test(msg)
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status} on ${url}: ${txt}`)
  }
  return (await res.json()) as T
}

async function resolveReachableBaseUrl(): Promise<string> {
  const envUrl = process.env.ADMIN_API_URL?.trim()
  const candidates = envUrl
    ? [envUrl.replace(/\/+$/, '')]
    : [buildBaseUrlFromEnvOrPort(), 'http://localhost:3500/api/admin', 'http://localhost:3001/api/admin']

  for (const baseUrl of candidates) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await requestJson<{ ok?: boolean }>(`${baseUrl}/me`)
        return baseUrl
      } catch (err) {
        if (!isNetworkError(err)) throw err
        if (attempt < 3) await sleep(700 * attempt)
      }
    }
  }
  throw new Error(`Admin API unreachable. Tried: ${candidates.join(', ')}`)
}

async function requestJsonWithRetry<T>(url: string, init?: RequestInit): Promise<T> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await requestJson<T>(url, init)
    } catch (err) {
      if (!isNetworkError(err) || attempt === 5) throw err
      await sleep(500 * attempt)
    }
  }
  throw new Error(`Unexpected retry exhaustion for ${url}`)
}

async function main(): Promise<void> {
  const baseUrl = await resolveReachableBaseUrl()
  console.log(`[data-enrich-cycle] Base admin API: ${baseUrl}`)

  const startRes = await requestJsonWithRetry<{ success?: boolean; error?: string; message?: string }>(
    `${baseUrl}/riot-script/start`,
    {
      method: 'POST',
      body: JSON.stringify({ script: 'data-enrich' }),
    }
  )
  if (startRes?.error) {
    throw new Error(startRes.error)
  }
  console.log(`[data-enrich-cycle] ${startRes.message ?? 'data-enrich started'}`)

  let spin = 0
  for (;;) {
    let s: ScriptStatusResponse
    try {
      s = await requestJsonWithRetry<ScriptStatusResponse>(`${baseUrl}/riot-script/status`)
    } catch (err) {
      if (isNetworkError(err)) {
        console.log('[data-enrich-cycle] admin API temporary unreachable, retrying...')
        await sleep(1500)
        continue
      }
      throw err
    }
    const runningDataEnrich = s.activeScript === 'data-enrich' && s.isRunning
    if (runningDataEnrich) {
      spin++
      if (spin % 4 === 0) {
        const rowsItems = s.counters?.rowsItems ?? 0
        const rowsRunes = s.counters?.rowsRunes ?? 0
        const rowsBuckets = s.counters?.rowsBuckets ?? 0
        const rowsRanks = s.counters?.rowsRanks ?? 0
        const missingMatches = s.counters?.missingMatches ?? 0
        const scanned = s.counters?.matchesScanned ?? 0
        const enriched = s.counters?.matchesEnriched ?? 0
        console.log(
          `[data-enrich-cycle] running missingMatches=${String(missingMatches)} scanned=${String(scanned)} enriched=${String(enriched)} items=${String(rowsItems)} runes=${String(rowsRunes)} buckets=${String(rowsBuckets)} ranks=${String(rowsRanks)}`
        )
      }
      await sleep(2000)
      continue
    }

    // data-enrich has finished when it becomes lastFinishedScript.
    if (s.lastFinishedScript === 'data-enrich') {
      if (s.lastError) throw new Error(`data-enrich failed: ${s.lastError}`)
      console.log('[data-enrich-cycle] data-enrich finished, poller restart handled by orchestrator.')
      break
    }

    // If not yet visible in status state machine, wait a bit and retry.
    await sleep(1500)
  }
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[data-enrich-cycle] Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  })

