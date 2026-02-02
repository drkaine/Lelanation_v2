/**
 * Prisma client singleton. Prisma 7 requires an adapter at runtime.
 * DATABASE_URL must be set for DB features (stats, match collection).
 * Client is created lazily on first use when DATABASE_URL is set.
 */
import { PrismaClient } from './generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is not set. Set it in .env to use stats and match collection.')
  }
  const adapter = new PrismaPg({ connectionString: url })
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

/** Use this for all DB access. Throws if DATABASE_URL is not set. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = getPrisma()
    const val = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? (val as Function).bind(client) : val
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = globalForPrisma.prisma
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}
