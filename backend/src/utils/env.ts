/** True only when NODE_ENV is explicitly "development". */
export function isDevelopmentEnv(): boolean {
  return process.env.NODE_ENV === 'development'
}
