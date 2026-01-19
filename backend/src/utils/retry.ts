import { Result } from './Result.js'
import { AppError } from './errors.js'

interface RetryOptions {
  maxRetries: number
  initialDelay: number // milliseconds
  maxDelay: number // milliseconds
  multiplier: number
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 10,
  initialDelay: 1000, // 1s
  maxDelay: 30000, // 30s
  multiplier: 2
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry (must return Result<T, E>)
 * @param options Retry configuration
 * @returns Result<T, E>
 */
export async function retryWithBackoff<T, E = Error>(
  fn: () => Promise<Result<T, E>>,
  options: Partial<RetryOptions> = {}
): Promise<Result<T, E>> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let delay = opts.initialDelay

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const result = await fn()

    if (result.isOk()) {
      return result
    }

    // If this was the last attempt, return the error
    if (attempt === opts.maxRetries) {
      return result
    }

    // Wait before retrying (exponential backoff)
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Calculate next delay (exponential, capped at maxDelay)
    delay = Math.min(delay * opts.multiplier, opts.maxDelay)
  }

  // This should never be reached, but TypeScript needs it
  return Result.err(
    new AppError('Retry exhausted all attempts', 'RETRY_EXHAUSTED') as E
  )
}
