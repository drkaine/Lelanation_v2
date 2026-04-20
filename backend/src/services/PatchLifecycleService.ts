import { prisma, isDatabaseConfigured } from '../db.js'

/**
 * Close a patch using DB-side lifecycle function.
 * Keeps patch archival/deletion concerns isolated from MV runtime services.
 */
export async function closePatch(patch: string): Promise<void> {
  if (!isDatabaseConfigured()) return
  const value = (patch ?? '').trim()
  if (!value) return
  await prisma.$executeRaw`SELECT close_patch(${value})`
}
