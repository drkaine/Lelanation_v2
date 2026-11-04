import { describe, expect, test } from 'vitest';
import { banRoleColumn } from '../../../src/workers/banRoleColumn.js';

describe('banRoleColumn', () => {
  test.each([
    ['TOP', 'count_banner_top'],
    ['JUNGLE', 'count_banner_jungle'],
    ['MIDDLE', 'count_banner_mid'],
    ['BOTTOM', 'count_banner_adc'],
    ['UTILITY', 'count_banner_support'],
    ['mid', 'count_banner_mid'],
    ['adc', 'count_banner_adc'],
    ['support', 'count_banner_support'],
  ])('%s -> %s', (role, column) => {
    expect(banRoleColumn(role)).toBe(column);
  });

  test('unknown role -> null', () => {
    expect(banRoleColumn('')).toBeNull();
    expect(banRoleColumn('INVALID')).toBeNull();
  });
});
