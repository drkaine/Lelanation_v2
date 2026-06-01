/**
 * Pool PostgreSQL + client Drizzle pour `lelanation_statistiques`.
 * Uses `DATABASE_URL_STATISTIQUES` if set, else `DATABASE_URL` (same as poller).
 */
function resolveStatistiquesDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL_STATISTIQUES?.trim() || process.env.DATABASE_URL?.trim() || ''
  if (!url) {
    throw new Error(
      'DATABASE_URL_STATISTIQUES or DATABASE_URL is required for lelanation_statistiques.',
    )
  }
  return url
}
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as statistiquesSchema from './statistiquesSchema.js'

const globalKey = Symbol.for('lelanation.statistiquesDrizzle')

type StatistiquesDb = ReturnType<typeof drizzle<typeof statistiquesSchema>>

const poolMax = Math.max(1, Math.min(20, parseInt(process.env.DRIZZLE_STATISTIQUES_POOL_MAX ?? '5', 10) || 5))

function createPool(): pg.Pool {
  return new pg.Pool({ connectionString: resolveStatistiquesDatabaseUrl(), max: poolMax })
}

let pool: pg.Pool | undefined

export function getStatistiquesPool(): pg.Pool {
  if (!pool) pool = createPool()
  return pool
}

export function getStatistiquesDb(): StatistiquesDb {
  const g = globalThis as unknown as Record<symbol, StatistiquesDb | undefined>
  if (!g[globalKey]) {
    g[globalKey] = drizzle(getStatistiquesPool(), { schema: statistiquesSchema })
  }
  return g[globalKey]!
}

export function isStatistiquesDatabaseConfigured(): boolean {
  return Boolean(
    process.env.DATABASE_URL_STATISTIQUES?.trim() || process.env.DATABASE_URL?.trim(),
  )
}

/** @deprecated use isStatistiquesDatabaseConfigured — single DB now */
export const isDatabaseConfigured = isStatistiquesDatabaseConfigured
