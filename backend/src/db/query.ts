/**
 * Raw SQL helpers for `lelanation_statistiques` (postgres.js).
 */
import { sql } from './client.js'

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

/** Execute raw SQL (caller must sanitize identifiers / values). */
export async function queryRawUnsafe<T>(query: string): Promise<T> {
  return (await sql.unsafe(query)) as T
}
