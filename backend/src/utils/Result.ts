/**
 * Result<T, E> - Monad pattern for error handling
 * Replaces try/catch with explicit error handling
 */
export class Result<T, E = Error> {
  private constructor(
    private readonly _value: T | null,
    private readonly _error: E | null,
    private readonly _isOk: boolean
  ) {}

  static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(value, null, true)
  }

  static err<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(null, error, false)
  }

  isOk(): boolean {
    return this._isOk
  }

  isErr(): boolean {
    return !this._isOk
  }

  unwrap(): T {
    // Important: allow `ok(null)` for optional return types (T can be null).
    // Only the ok/err flag determines unwrap safety.
    if (this._isOk) {
      return this._value as T
    }
    throw new Error('Attempted to unwrap an error result')
  }

  unwrapErr(): E {
    if (!this._isOk) {
      return this._error as E
    }
    throw new Error('Attempted to unwrapErr an ok result')
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this._isOk) {
      try {
        return Result.ok(fn(this._value as T))
      } catch (error) {
        return Result.err(error as E)
      }
    }
    return Result.err(this._error as E)
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    if (!this._isOk) {
      return Result.err(fn(this._error as E))
    }
    return Result.ok(this._value as T)
  }
}
