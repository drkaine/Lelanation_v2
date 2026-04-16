/**
 * Match ingest skip / unwrap helpers shared by legacy and lean ingest paths.
 */

export class MatchIngestSkippedError extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(`Match ingest skipped (${reason})`)
    this.name = 'MatchIngestSkippedError'
    this.reason = reason
  }
}

export function isMatchIngestSkippedError(e: unknown): e is MatchIngestSkippedError {
  return e instanceof MatchIngestSkippedError
}

/** Prisma may wrap errors thrown inside `$transaction` — unwrap `cause` chain. */
export function unwrapMatchIngestSkipped(err: unknown): MatchIngestSkippedError | null {
  if (isMatchIngestSkippedError(err)) return err
  if (err instanceof Error && err.cause != null) return unwrapMatchIngestSkipped(err.cause)
  return null
}
