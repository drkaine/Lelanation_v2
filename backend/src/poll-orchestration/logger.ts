import pino from 'pino';

export const orchestrationLogger = pino({
  name: 'poll-orchestration',
  level: process.env.LOG_LEVEL ?? 'info',
});
