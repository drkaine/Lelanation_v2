import pino from 'pino';

export const pollerMetricsLogger = pino({
  name: 'poller-metrics',
  level: process.env.LOG_LEVEL ?? 'info',
});
