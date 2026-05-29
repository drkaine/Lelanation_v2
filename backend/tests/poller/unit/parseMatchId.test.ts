import { describe, expect, test } from 'vitest';
import { ParseMatchIdError, isValidMatchId, parsePlatformFromMatchId } from '../../../src/poller/utils/parseMatchId.js';

describe('parseMatchId', () => {
  test('parses known platforms', () => {
    expect(parsePlatformFromMatchId('EUW1_1234567890')).toBe('euw1');
    expect(parsePlatformFromMatchId('NA1_9876543210')).toBe('na1');
    expect(parsePlatformFromMatchId('KR_1122334455')).toBe('kr');
    expect(parsePlatformFromMatchId('TW2_5566778899')).toBe('tw2');
  });

  test('throws on invalid ids', () => {
    expect(() => parsePlatformFromMatchId('INVALID')).toThrow(ParseMatchIdError);
    expect(() => parsePlatformFromMatchId('')).toThrow(ParseMatchIdError);
    expect(() => parsePlatformFromMatchId('EUW1_')).toThrow(ParseMatchIdError);
  });

  test('isValidMatchId', () => {
    expect(isValidMatchId('EUW1_123')).toBe(true);
    expect(isValidMatchId('INVALID')).toBe(false);
  });
});
