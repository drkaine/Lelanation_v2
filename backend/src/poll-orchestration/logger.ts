import pino from 'pino';
import { errorCaptureHooks } from '../logging/errorCapture.js';

export const orchestrationLogger = pino({
  name: 'poll-orchestration',
  hooks: errorCaptureHooks,
  level: process.env.LOG_LEVEL ?? 'info',
});
