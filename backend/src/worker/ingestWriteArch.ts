/**
 * `INGEST_WRITE_ARCH=lean` → new `ingest_*` tables only. Default `legacy` → existing `matchs` path.
 */
export type IngestWriteArch = 'legacy' | 'lean'

export function getIngestWriteArch(): IngestWriteArch {
  const raw = (process.env.INGEST_WRITE_ARCH ?? 'lean').trim().toLowerCase()
  if (raw === 'lean') return 'lean'
  return 'legacy'
}

export function isLeanIngestWriteArch(): boolean {
  return getIngestWriteArch() === 'lean'
}
