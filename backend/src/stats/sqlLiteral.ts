/** Escape a value for a single-quoted SQL string literal. */
export const sqlLiteral = (s: string): string => s.replace(/'/g, "''")
