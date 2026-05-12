/**
 * Pool PostgreSQL + client Drizzle pour `lelanation_statistiques`.
 * `DATABASE_URL_STATISTIQUES` — voir docker-compose.yml (postgres-statistiques, port 5434).
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as statistiquesSchema from './statistiquesSchema.js'

const globalKey = Symbol.for('lelanation.statistiquesDrizzle')

type StatistiquesDb = ReturnType<typeof drizzle<typeof statistiquesSchema>>

const poolMax = Math.max(1, Math.min(20, parseInt(process.env.DRIZZLE_STATISTIQUES_POOL_MAX ?? '2', 10) || 2))

function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL_STATISTIQUES?.trim()
  if (!url) {
    throw new Error('DATABASE_URL_STATISTIQUES is not set. Required for Drizzle statistiques DB.')
  }
  return new pg.Pool({ connectionString: url, max: poolMax })
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
  return Boolean(process.env.DATABASE_URL_STATISTIQUES?.trim())
}
