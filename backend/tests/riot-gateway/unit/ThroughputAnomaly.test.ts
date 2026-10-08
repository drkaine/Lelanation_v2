import { describe, expect, it } from 'vitest';
import { detectThroughputAnomaly } from '../../../src/riot-gateway/gateway/MetricsCollector.js';

describe('detectThroughputAnomaly', () => {
  it('ignores low-traffic noise (3 req in 5s vs 0.78 rps avg)', () => {
    expect(detectThroughputAnomaly(0.6, 0.78333)).toBe(false);
  });

  it('flags a real drop at meaningful traffic', () => {
    expect(detectThroughputAnomaly(2, 10)).toBe(true);
  });

  it('does not flag steady traffic', () => {
    expect(detectThroughputAnomaly(9, 10)).toBe(false);
    expect(detectThroughputAnomaly(0, 0)).toBe(false);
  });
});
