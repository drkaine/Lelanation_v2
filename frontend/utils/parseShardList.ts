/** Parse shard_list from API/DB (`5008_5005_5001`) or comma-separated legacy values. */
export function parseShardList(raw: string | number[] | null | undefined): number[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.filter(n => Number.isFinite(n) && n > 0)
  }
  const trimmed = String(raw).trim()
  if (!trimmed) return []
  const sep = trimmed.includes('_') ? '_' : ','
  return trimmed
    .split(sep)
    .map(x => Number(String(x).trim()))
    .filter(n => Number.isFinite(n) && n > 0)
}
