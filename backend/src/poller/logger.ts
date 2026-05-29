import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';

export const pollerLogger = pino({
  name: 'poller',
  level,
});
