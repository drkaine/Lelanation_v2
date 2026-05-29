import pino from 'pino';
import { riotConfig } from './config/riotConfig.js';

const isDev = process.env.NODE_ENV !== 'production';

export const gatewayLogger = pino({
  name: 'riot-gateway',
  level: riotConfig.logLevel,
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        },
      }
    : {}),
});
