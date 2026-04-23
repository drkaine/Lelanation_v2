export class HttpRequestError extends Error {
  statusCode?: number
  responseBody?: unknown

  constructor(message: string, statusCode?: number, responseBody?: unknown, cause?: unknown) {
    super(message)
    this.name = 'HttpRequestError'
    this.statusCode = statusCode
    this.responseBody = responseBody
    if (cause !== undefined) {
      ;(this as Error & { cause?: unknown }).cause = cause
    }
  }
}

type FetchRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  timeoutMs?: number
}

function buildUrl(input: string, query?: FetchRequestOptions['query']): string {
  if (!query) return input
  const url = new URL(input)
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

async function request(input: string, options: FetchRequestOptions = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 30_000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = buildUrl(input, options.query)
    const headers: Record<string, string> = { ...(options.headers ?? {}) }
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
      signal: controller.signal,
    }
    if (options.body !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
      init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    }
    return await fetch(url, init)
  } catch (error) {
    throw new HttpRequestError(
      error instanceof Error ? error.message : 'Network request failed',
      undefined,
      undefined,
      error
    )
  } finally {
    clearTimeout(timer)
  }
}

async function parseErrorBody(response: Response): Promise<unknown> {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  const raw = await response.text()
  if (!raw) return null
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

export async function fetchJson<T = unknown>(
  input: string,
  options: FetchRequestOptions = {}
): Promise<T> {
  const response = await request(input, options)
  if (!response.ok) {
    const body = await parseErrorBody(response)
    throw new HttpRequestError(`HTTP ${response.status}`, response.status, body)
  }
  const text = await response.text()
  if (!text) return null as T
  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new HttpRequestError('Invalid JSON response', response.status, text, error)
  }
}

export async function fetchBuffer(
  input: string,
  options: FetchRequestOptions = {}
): Promise<Buffer> {
  const response = await request(input, options)
  if (!response.ok) {
    const body = await parseErrorBody(response)
    throw new HttpRequestError(`HTTP ${response.status}`, response.status, body)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function postJson(
  input: string,
  body: unknown,
  options: Omit<FetchRequestOptions, 'method' | 'body'> = {}
): Promise<void> {
  const response = await request(input, { ...options, method: 'POST', body })
  if (!response.ok) {
    const parsedBody = await parseErrorBody(response)
    throw new HttpRequestError(`HTTP ${response.status}`, response.status, parsedBody)
  }
}
