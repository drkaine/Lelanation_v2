/** Narrows a free string (e.g. a `<select>` value) to one of the allowed literal values. */
export function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  const allowed: readonly string[] = values
  return allowed.includes(value)
}
