import pino from 'pino';

export const tunerLogger = pino({
  name: 'poller-tuner',
  level: process.env.LOG_LEVEL ?? 'info',
});
