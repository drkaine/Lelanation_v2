/**
 * Prisma client singleton. Prisma 7 requires an adapter at runtime.
 * DATABASE_URL must be set for DB features (stats, match collection).
 * Client is created lazily on first use when DATABASE_URL is set.
 * All DB operations retry on connection errors (P2037, P1001, P1002): disconnect to release connections, wait, recreate client, retry.
 */
import { PrismaClient } from './generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

/** Max connections per process. Default 2 so backend + worker + child scripts stay under PostgreSQL max_connections (often 10–20). Override with PRISMA_POOL_MAX. */
const PRISMA_POOL_MAX = Math.max(1, Math.min(20, parseInt(process.env.PRISMA_POOL_MAX ?? '2', 10) || 2))

/** Retry config for connection errors. Override with DB_RETRY_MAX, DB_RETRY_BASE_DELAY_MS. */
const DB_RETRY_MAX = Math.max(1, parseInt(process.env.DB_RETRY_MAX ?? '5', 10) || 5)
const DB_RETRY_BASE_DELAY_MS = Math.max(500, parseInt(process.env.DB_RETRY_BASE_DELAY_MS ?? '2000', 10) || 2000)

const RETRYABLE_CODES = new Set(['P2037', 'P1001', 'P1002', 'P1017'])

function isRetryableDbError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return RETRYABLE_CODES.has(String((err as { code?: string }).code))
  }
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('too many clients') || msg.includes('TooManyConnections')
}

async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= DB_RETRY_MAX; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryableDbError(err) || attempt === DB_RETRY_MAX) throw err
      try {
        if (globalForPrisma.prisma) {
          await globalForPrisma.prisma.$disconnect()
          globalForPrisma.prisma = undefined
        }
      } catch {
        globalForPrisma.prisma = undefined
      }
      const delay = DB_RETRY_BASE_DELAY_MS * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastErr
}

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is not set. Set it in .env to use stats and match collection.')
  }
  const adapter = new PrismaPg({
    connectionString: url,
    max: PRISMA_POOL_MAX,
  })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  globalForPrisma.prisma = createPrisma()
  return globalForPrisma.prisma
}

function wrapWithRetry<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, prop) {
      const val = (obj as Record<string | symbol, unknown>)[prop]
      if (typeof val === 'function') {
        return (...args: unknown[]) =>
          withDbRetry(() => (val as (...a: unknown[]) => Promise<unknown>).apply(obj, args))
      }
      if (
        val &&
        typeof val === 'object' &&
        val !== null &&
        !(val instanceof Promise) &&
        !(val instanceof Date)
      ) {
        return wrapWithRetry(val as object)
      }
      return val
    },
  }) as T
}

/** Use this for all DB access. Throws if DATABASE_URL is not set. All operations retry on connection errors. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = getPrisma()
    const val = (client as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof val === 'function') {
      return (...args: unknown[]) =>
        withDbRetry(() => (val as (...a: unknown[]) => Promise<unknown>).apply(client, args))
    }
    if (val && typeof val === 'object' && val !== null) {
      return wrapWithRetry(val as object)
    }
    return val
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = globalForPrisma.prisma
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}
