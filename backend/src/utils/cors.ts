import cors from 'cors'
import { isDevelopmentEnv } from './env.js'

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://lelanation.fr',
  'https://www.lelanation.fr',
]

function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim()
  if (!raw) return DEFAULT_ORIGINS
  return raw
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

export function createCorsMiddleware() {
  const allowed = new Set(parseAllowedOrigins())

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (allowed.has(origin)) return callback(null, true)
      if (isDevelopmentEnv() && LOCALHOST_ORIGIN.test(origin)) {
        return callback(null, true)
      }
      return callback(null, false)
    },
  })
}
