import pino from 'pino';
import { errorCaptureHooks } from '../logging/errorCapture.js';

const level = process.env.LOG_LEVEL ?? 'info';

export const pollerLogger = pino({
  name: 'poller',
  hooks: errorCaptureHooks,
  level,
});
