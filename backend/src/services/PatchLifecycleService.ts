import { prisma, isDatabaseConfigured } from '../db.js'
import { invalidateAggArchivePartitionCache } from './statsAggArchive.js'

/**
 * Close a patch using DB-side lifecycle function.
 * Keeps patch archival/deletion concerns isolated from MV runtime services.
 */
/** JSON from SQL close_patch(): games, row counts, etc. */
export async function closePatch(patch: string): Promise<unknown> {
  if (!isDatabaseConfigured()) return null
  const value = (patch ?? '').trim()
  if (!value) return null
  const rows = await prisma.$queryRaw<[{ close_patch: unknown }]>`
    SELECT close_patch(${value}::text) AS close_patch
  `
  invalidateAggArchivePartitionCache()
  return rows[0]?.close_patch ?? null
}
