/** Camp sequence of `jungle_camp_history->'early_path'->'path_sequence'` (jsonb, parsed or raw text). */
export function junglePathSequence(value: unknown): string[] {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return []
    }
  }
  return Array.isArray(parsed) ? parsed.map(String) : []
}
