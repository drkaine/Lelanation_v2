import { afterEach, describe, expect, test } from 'vitest';
import pino from 'pino';
import {
  createErrorForwarder,
  errorCaptureHooks,
  installConsoleErrorCapture,
  pinoArgsToMessage,
  setErrorForwarder,
  type CapturedError,
} from '../../../../src/logging/errorCapture.js';

const T0 = Date.parse('2026-09-24T12:00:00.000Z');

function collector(nowRef: { t: number } = { t: T0 }) {
  const out: CapturedError[] = [];
  const forward = createErrorForwarder({
    script: 'poller',
    throttleMs: 60_000,
    now: () => nowRef.t,
    append: (e) => {
      out.push(e);
    },
  });
  return { out, forward, nowRef };
}

afterEach(() => setErrorForwarder(null));

describe('createErrorForwarder', () => {
  test('forwarder_appends_error_with_script_and_source', () => {
    const c = collector();

    c.forward('db connection lost', 'console');

    expect(c.out).toEqual([{ script: 'poller', message: 'db connection lost', source: 'console', suppressed: 0 }]);
  });

  test('forwarder_throttles_same_message_when_differing_only_by_numbers', () => {
    const c = collector();
    c.forward('match 123 failed', 'pino');
    c.forward('match 456 failed', 'pino');
    c.nowRef.t += 61_000;

    c.forward('match 789 failed', 'pino');

    expect(c.out.map((e) => [e.message, e.suppressed])).toEqual([
      ['match 123 failed', 0],
      ['match 789 failed', 1],
    ]);
  });
});

describe('pinoArgsToMessage', () => {
  test('pino_message_joins_msg_and_error_when_object_first', () => {
    expect(pinoArgsToMessage([{ err: new Error('boom') }, 'fetch failed'])).toBe('fetch failed: boom');
  });

  test('pino_message_uses_error_message_when_error_only', () => {
    expect(pinoArgsToMessage([new Error('boom')])).toBe('boom');
  });

  test('pino_message_uses_string_when_string_only', () => {
    expect(pinoArgsToMessage(['plain'])).toBe('plain');
  });
});

describe('capture wiring', () => {
  test('pino_error_is_forwarded_when_hooks_are_installed', () => {
    const c = collector();
    setErrorForwarder(c.forward);
    const logger = pino({ level: 'info', hooks: errorCaptureHooks }, { write: () => undefined });

    logger.error({ err: new Error('x') }, 'ingestion failed');
    logger.warn('only a warning');

    expect(c.out.map((e) => [e.message, e.source])).toEqual([['ingestion failed: x', 'pino']]);
  });

  test('console_error_is_forwarded_and_still_printed_when_capture_installed', () => {
    const c = collector();
    const printed: unknown[][] = [];
    const target = { error: (...args: unknown[]) => printed.push(args) };
    const restore = installConsoleErrorCapture(c.forward, target);

    target.error('[Server] failed', 42);
    restore();
    target.error('after restore');

    expect([c.out.map((e) => e.message), printed.length]).toEqual([['[Server] failed 42'], 2]);
  });
});
