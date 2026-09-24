/** Copy of `items` with positions `i` and `j` exchanged (unchanged copy when out of range). */
export function swapItems<T>(items: readonly T[], i: number, j: number): T[] {
  const out = [...items]
  const a = out[i]
  const b = out[j]
  if (a === undefined || b === undefined) return out
  out[i] = b
  out[j] = a
  return out
}
