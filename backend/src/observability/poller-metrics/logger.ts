import pino from 'pino';
import { errorCaptureHooks } from '../../logging/errorCapture.js';

export const pollerMetricsLogger = pino({
  name: 'poller-metrics',
  hooks: errorCaptureHooks,
  level: process.env.LOG_LEVEL ?? 'info',
});
