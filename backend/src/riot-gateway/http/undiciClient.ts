import { Pool } from 'undici';
import { riotConfig } from '../config/riotConfig.js';
import { gatewayLogger } from '../logger.js';
import { RiotHttpError, RiotNetworkError } from '../types.js';

const pools = new Map<string, Pool>();

function getPool(baseUrl: string): Pool {
  const origin = baseUrl.replace(/\/$/, '');
  let pool = pools.get(origin);
  if (!pool) {
    pool = new Pool(origin, {
      connections: riotConfig.maxConcurrency,
      pipelining: 1,
      connect: { timeout: 10_000 },
      bodyTimeout: 15_000,
      headersTimeout: 10_000,
    });
    pools.set(origin, pool);
  }
  return pool;
}

function buildPath(path: string, queryParams?: Record<string, string | number>): string {
  const pathname = path.startsWith('/') ? path : `/${path}`;
  if (!queryParams) return pathname;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function headersToRecord(headers: string[] | Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(headers)) {
    for (let i = 0; i < headers.length; i += 2) {
      const key = headers[i];
      const value = headers[i + 1];
      if (key) out[key.toLowerCase()] = String(value ?? '');
    }
    return out;
  }
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT'
  );
}

export async function riotFetch(
  baseUrl: string,
  path: string,
  queryParams?: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  latencyMs: number;
}> {
  const origin = baseUrl.replace(/\/$/, '');
  const requestPath = buildPath(path, queryParams);
  const url = `${origin}${requestPath}`;
  const startedAt = Date.now();

  try {
    const pool = getPool(origin);
    const response = await pool.request({
      path: requestPath,
      method: 'GET',
      headers: {
        'X-Riot-Token': riotConfig.apiKey,
        Accept: 'application/json',
      },
      signal,
    });

    const latencyMs = Date.now() - startedAt;
    const headers = headersToRecord(response.headers as Record<string, string | string[]>);
    const text = await response.body.text();
    let body: unknown = text;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (text) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = text;
        }
      } else {
        body = null;
      }
      return { statusCode: response.statusCode, headers, body, latencyMs };
    }

    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }

    if (response.statusCode === 429 || response.statusCode >= 500) {
      return { statusCode: response.statusCode, headers, body, latencyMs };
    }

    throw new RiotHttpError(response.statusCode, url, `Riot HTTP ${response.statusCode}`, body);
  } catch (error) {
    if (error instanceof RiotHttpError) throw error;
    if (isNetworkError(error)) {
      gatewayLogger.error(
        {
          component: 'undiciClient',
          event: 'network_error',
          url,
          errorCode: (error as NodeJS.ErrnoException).code,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
        'Network error calling Riot API',
      );
      throw new RiotNetworkError(`Network error: ${url}`, error);
    }
    throw error;
  }
}

export async function closeAllPools(): Promise<void> {
  await Promise.all([...pools.values()].map((pool) => pool.close()));
  pools.clear();
}
