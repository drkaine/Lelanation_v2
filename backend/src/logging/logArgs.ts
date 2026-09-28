/** Formatting of the extra arguments of the logger helpers (`log(msg, ...rest)`). */

function argToString(arg: unknown): string {
  return typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
}

/** `msg` followed by the extra args (objects serialized as JSON). */
export function formatLogArgs(msg: string, rest: unknown[]): string {
  return rest.length > 0 ? `${msg} ${rest.map(argToString).join(' ')}` : msg
}

/** Unified log `json` field: a single plain object as is, otherwise `{ details: [...] }`. */
export function logArgsJson(rest: unknown[]): Record<string, unknown> | null {
  if (rest.length === 0) return null
  if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null && !Array.isArray(rest[0])) {
    return rest[0] as Record<string, unknown>
  }
  return { details: rest.map(argToString) }
}
