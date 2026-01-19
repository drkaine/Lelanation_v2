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
    if (this._isOk && this._value !== null) {
      return this._value
    }
    throw new Error('Attempted to unwrap an error result')
  }

  unwrapErr(): E {
    if (!this._isOk && this._error !== null) {
      return this._error
    }
    throw new Error('Attempted to unwrapErr an ok result')
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this._isOk && this._value !== null) {
      try {
        return Result.ok(fn(this._value))
      } catch (error) {
        return Result.err(error as E)
      }
    }
    return Result.err(this._error!)
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    if (!this._isOk && this._error !== null) {
      return Result.err(fn(this._error))
    }
    return Result.ok(this._value!)
  }
}
