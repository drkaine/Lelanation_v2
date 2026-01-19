/**
 * Custom error classes for better error handling
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 'NOT_FOUND', cause)
    this.name = 'NotFoundError'
  }
}

export class ExternalApiError extends AppError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    cause?: unknown
  ) {
    super(message, 'EXTERNAL_API_ERROR', cause)
    this.name = 'ExternalApiError'
  }
}
