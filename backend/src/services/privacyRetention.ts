/**
 * Rétention RGPD : messages de contact et journaux tournés supprimés au-delà de 12 mois
 * (durées annoncées dans la politique de confidentialité du site).
 */
import { promises as fs } from 'fs'
import { join } from 'path'

export const RETENTION_MS = 365 * 24 * 60 * 60 * 1000

type ContactEntryLike = { date?: unknown }
type ContactDataLike = Record<string, ContactEntryLike[]>

/** Fichiers produits par logrotate / pm2 (`x.log.1`, `x.log.4.gz`) ; le fichier actif est exclu. */
const ROTATED_LOG_RE = /\.log\.\d+(\.gz)?$/

export function purgeContactData<T extends ContactDataLike>(
  data: T,
  now: number
): { data: T; removed: number } {
  let removed = 0
  const kept = {} as Record<string, ContactEntryLike[]>
  for (const [type, entries] of Object.entries(data)) {
    if (!Array.isArray(entries)) continue
    kept[type] = entries.filter(entry => {
      const at = typeof entry.date === 'string' ? Date.parse(entry.date) : NaN
      const keep = Number.isFinite(at) && now - at <= RETENTION_MS
      if (!keep) removed++
      return keep
    })
  }
  return { data: kept as T, removed }
}

export function expiredLogFiles(
  files: Array<{ name: string; mtimeMs: number }>,
  now: number
): string[] {
  return files
    .filter(f => ROTATED_LOG_RE.test(f.name) && now - f.mtimeMs > RETENTION_MS)
    .map(f => f.name)
}

async function purgeContactFile(file: string, now: number): Promise<number> {
  let raw: string
  try {
    raw = await fs.readFile(file, 'utf-8')
  } catch {
    return 0
  }
  const { data, removed } = purgeContactData(JSON.parse(raw) as ContactDataLike, now)
  if (removed > 0) await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
  return removed
}

async function purgeLogDir(dir: string, now: number): Promise<number> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch {
    return 0
  }
  const files = await Promise.all(
    names.map(async name => ({ name, mtimeMs: (await fs.stat(join(dir, name))).mtimeMs }))
  )
  const expired = expiredLogFiles(files, now)
  await Promise.all(expired.map(name => fs.unlink(join(dir, name))))
  return expired.length
}

export async function runPrivacyRetention({
  contactFile,
  logDir,
  now = Date.now(),
  withContactLock = task => task(),
}: {
  contactFile: string
  logDir: string
  now?: number
  /** Verrou partagé avec POST /api/contact (lecture-modification-écriture du même fichier). */
  withContactLock?: <T>(task: () => Promise<T>) => Promise<T>
}): Promise<{ contactRemoved: number; logFilesRemoved: number }> {
  const contactRemoved = await withContactLock(() => purgeContactFile(contactFile, now))
  const logFilesRemoved = await purgeLogDir(logDir, now)
  return { contactRemoved, logFilesRemoved }
}
