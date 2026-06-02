import { PollerTuner } from '../../../src/tuner/PollerTuner.js';

/** Run a test block with a specific API_KEY_TYPE (resets PollerTuner singleton). */
export function withApiKeyType<T>(type: 'personal' | 'production', fn: () => T): T {
  const prev = process.env.API_KEY_TYPE;
  process.env.API_KEY_TYPE = type;
  PollerTuner.resetInstance();
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.API_KEY_TYPE;
    else process.env.API_KEY_TYPE = prev;
    PollerTuner.resetInstance();
  }
}
