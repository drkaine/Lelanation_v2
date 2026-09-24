import pino from 'pino';
import { errorCaptureHooks } from '../logging/errorCapture.js';

export const tunerLogger = pino({
  name: 'poller-tuner',
  hooks: errorCaptureHooks,
  level: process.env.LOG_LEVEL ?? 'info',
});
