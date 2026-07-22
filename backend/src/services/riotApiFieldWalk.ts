export type ValueType = 'texte' | 'entier' | 'décimal' | 'boolean' | 'tableau' | 'objet'

export type FieldLeaf = {
  source: 'match' | 'timeline'
  path: string
  key: string
  valueType: ValueType
  sampleValue: string | null
}

function inferType(value: unknown): ValueType {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return Number.isInteger(value) ? 'entier' : 'décimal'
  if (typeof value === 'string') return 'texte'
  if (Array.isArray(value)) return 'tableau'
  if (value !== null && typeof value === 'object') return 'objet'
  return 'texte'
}

function formatSample(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}…` : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `[${value.length} éléments]`
  return '{objet}'
}

function walk(value: unknown, source: 'match' | 'timeline', prefix: string, out: Map<string, FieldLeaf>): void {
  if (value === null || value === undefined) return

  if (Array.isArray(value)) {
    if (value.length === 0) return
    walk(value[0], source, `${prefix}[]`, out)
    return
  }

  if (typeof value !== 'object') return

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return

  const allNumericKeys = entries.every(([k]) => /^\d+$/.test(k))
  if (allNumericKeys && typeof entries[0]?.[1] === 'object' && entries[0][1] !== null) {
    walk(entries[0][1], source, `${prefix}.*`, out)
    return
  }

  for (const [key, child] of entries) {
    if (key === 'route' || key === 'args') continue
    const path = prefix ? `${prefix}.${key}` : key

    if (child !== null && typeof child === 'object') {
      walk(child, source, path, out)
      continue
    }

    const valueType = inferType(child)
    const id = `${source}|${path}`
    if (out.has(id)) continue
    out.set(id, {
      source,
      path,
      key,
      valueType,
      sampleValue: formatSample(child),
    })
  }
}

export function collectFieldLeavesFromPayload(
  matchJson: Record<string, unknown>,
  timelineJson: Record<string, unknown>,
): Map<string, FieldLeaf> {
  const leaves = new Map<string, FieldLeaf>()
  walk(matchJson, 'match', '', leaves)
  walk(timelineJson, 'timeline', '', leaves)
  return leaves
}

export function fieldRowId(source: 'match' | 'timeline', path: string): string {
  return `${source}|${path}`
}
