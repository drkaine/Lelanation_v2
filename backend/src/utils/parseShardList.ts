/** Parse `shard_list` from DB (e.g. `5008_5005_5001`) or legacy comma-separated values. */
export function parseShardList(raw: string | null | undefined): number[] {
  if (raw == null) return []
  const trimmed = String(raw).trim()
  if (!trimmed) return []
  const sep = trimmed.includes('_') ? '_' : ','
  return trimmed
    .split(sep)
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}
