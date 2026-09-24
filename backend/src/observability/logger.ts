import pino from 'pino'
import { errorCaptureHooks } from '../logging/errorCapture.js'

export const obsLogger = pino({
  name: 'poller-observability',
  hooks: errorCaptureHooks,
  level: process.env.OBS_LOG_LEVEL ?? 'info',
})
