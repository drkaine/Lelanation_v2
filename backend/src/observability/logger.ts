import pino from 'pino'

export const obsLogger = pino({
  name: 'poller-observability',
  level: process.env.OBS_LOG_LEVEL ?? 'info',
})
