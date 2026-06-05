/**
 * Standard logger for scraper and general modules
 * Uses unified logging system for consistency
 */

import { appendUnifiedLog, type LogType } from '../logging/unifiedAppLog.js';

const SCRIPT_NAME = 'patch_scraper';

function restToJson(rest: unknown[]): Record<string, unknown> | null {
  if (rest.length === 0) return null;
  if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null && !Array.isArray(rest[0])) {
    return rest[0] as Record<string, unknown>;
  }
  return { details: rest.map((r) => (typeof r === 'object' ? JSON.stringify(r) : String(r))) };
}

function formatMessage(msg: string, rest: unknown[]): string {
  if (rest.length === 0) return msg;
  // If first arg is string and looks like a message prefix, append it
  if (typeof rest[0] === 'string') {
    return `${msg}: ${rest[0]}`;
  }
  return msg;
}

async function writeLog(level: LogType, message: string, rest: unknown[]): Promise<void> {
  const formattedMessage = formatMessage(message, rest);
  const json = restToJson(rest);

  await appendUnifiedLog({
    section: 'back',
    type: level,
    script: SCRIPT_NAME,
    message: formattedMessage,
    json,
  });
}

/**
 * Standard logger interface compatible with pino-style usage
 * Supports both simple messages and structured logging with objects
 */
export const logger = {
  /**
   * Debug level - detailed diagnostic information
   * Usage: logger.debug({ entity: 'Nami' }, 'Processing champion')
   *        logger.debug('Processing champion %s', 'Nami')
   *        logger.debug('Simple message')
   */
  debug: async (msgOrObj: string | Record<string, unknown>, ...rest: unknown[]): Promise<void> => {
    let message: string;
    let mergedRest: unknown[];

    if (typeof msgOrObj === 'object') {
      message = JSON.stringify(msgOrObj);
      mergedRest = [...rest];
    } else {
      message = msgOrObj;
      mergedRest = rest;
    }

    // Debug logs only go to unified log, not console
    await writeLog('info', `[DEBUG] ${message}`, mergedRest);
  },

  /**
   * Info level - general informational messages
   */
  info: async (msgOrObj: string | Record<string, unknown>, ...rest: unknown[]): Promise<void> => {
    let message: string;
    let mergedRest: unknown[];

    if (typeof msgOrObj === 'object') {
      message = rest[0] as string || 'Info';
      mergedRest = [msgOrObj, ...rest.slice(1)];
    } else {
      message = msgOrObj;
      mergedRest = rest;
    }

    await writeLog('info', message, mergedRest);
  },

  /**
   * Warn level - warning messages
   */
  warn: async (msgOrObj: string | Record<string, unknown>, ...rest: unknown[]): Promise<void> => {
    let message: string;
    let mergedRest: unknown[];

    if (typeof msgOrObj === 'object') {
      message = rest[0] as string || 'Warning';
      mergedRest = [msgOrObj, ...rest.slice(1)];
    } else {
      message = msgOrObj;
      mergedRest = rest;
    }

    console.warn(`[${SCRIPT_NAME}]`, message, ...rest);
    await writeLog('warning', message, mergedRest);
  },

  /**
   * Error level - error messages
   */
  error: async (msgOrObj: string | Record<string, unknown>, ...rest: unknown[]): Promise<void> => {
    let message: string;
    let mergedRest: unknown[];

    if (typeof msgOrObj === 'object') {
      message = rest[0] as string || 'Error';
      mergedRest = [msgOrObj, ...rest.slice(1)];
    } else {
      message = msgOrObj;
      mergedRest = rest;
    }

    console.error(`[${SCRIPT_NAME}]`, message, ...rest);
    await writeLog('erreur', message, mergedRest);
  },

  /**
   * Trace level - very detailed tracing (mapped to debug)
   */
  trace: async (msgOrObj: string | Record<string, unknown>, ...rest: unknown[]): Promise<void> => {
    await logger.debug(msgOrObj, ...rest);
  },

  /**
   * Fatal level - fatal errors (mapped to error)
   */
  fatal: async (msgOrObj: string | Record<string, unknown>, ...rest: unknown[]): Promise<void> => {
    await logger.error(msgOrObj, ...rest);
  },
};

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): typeof logger {
  return {
    debug: async (msgOrObj, ...rest) => {
      const merged = typeof msgOrObj === 'object'
        ? { ...context, ...msgOrObj }
        : context;
      await logger.debug(merged, msgOrObj as string, ...rest);
    },
    info: async (msgOrObj, ...rest) => {
      const merged = typeof msgOrObj === 'object'
        ? { ...context, ...msgOrObj }
        : context;
      await logger.info(merged, msgOrObj as string, ...rest);
    },
    warn: async (msgOrObj, ...rest) => {
      const merged = typeof msgOrObj === 'object'
        ? { ...context, ...msgOrObj }
        : context;
      await logger.warn(merged, msgOrObj as string, ...rest);
    },
    error: async (msgOrObj, ...rest) => {
      const merged = typeof msgOrObj === 'object'
        ? { ...context, ...msgOrObj }
        : context;
      await logger.error(merged, msgOrObj as string, ...rest);
    },
    trace: async (msgOrObj, ...rest) => {
      const merged = typeof msgOrObj === 'object'
        ? { ...context, ...msgOrObj }
        : context;
      await logger.trace(merged, msgOrObj as string, ...rest);
    },
    fatal: async (msgOrObj, ...rest) => {
      const merged = typeof msgOrObj === 'object'
        ? { ...context, ...msgOrObj }
        : context;
      await logger.fatal(merged, msgOrObj as string, ...rest);
    },
  };
}
