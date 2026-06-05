import { describe, it, expect } from 'vitest';
import {
  extractPatchVersion,
  buildPatchNotesUrl,
  getFrUrl,
  getEnUrl,
  isValidPatchUrl,
  parsePatchDate,
} from '../../src/utils/helpers.js';

describe('helpers', () => {
  describe('extractPatchVersion', () => {
    it('should extract version from standard URL format', () => {
      const url = 'https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-11-notes/';
      expect(extractPatchVersion(url)).toBe('26.11');
    });

    it('should extract version from URL with dot notation', () => {
      const url = 'https://www.leagueoflegends.com/en-gb/news/game-updates/patch-26.11-notes/';
      expect(extractPatchVersion(url)).toBe('26.11');
    });

    it('should extract version from URL with patch prefix', () => {
      const url = 'https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-25-10-notes/';
      expect(extractPatchVersion(url)).toBe('25.10');
    });

    it('should extract version from URL with number dot format', () => {
      const url = 'https://example.com/patch-14.5/';
      expect(extractPatchVersion(url)).toBe('14.5');
    });

    it('should throw for invalid URL', () => {
      expect(() => extractPatchVersion('https://example.com/no-version-here/')).toThrow();
    });
  });

  describe('buildPatchNotesUrl', () => {
    it('should build URL from major.minor version', () => {
      expect(buildPatchNotesUrl('26.11')).toBe(
        'https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-26-11-notes/'
      );
    });

    it('should build URL from full game version', () => {
      expect(buildPatchNotesUrl('16.4.1')).toBe(
        'https://www.leagueoflegends.com/en-gb/news/game-updates/league-of-legends-patch-16-4-notes/'
      );
    });
  });

  describe('getFrUrl', () => {
    it('should convert en-gb URL to fr-fr', () => {
      const enUrl = 'https://www.leagueoflegends.com/en-gb/news/game-updates/patch-notes/';
      expect(getFrUrl(enUrl)).toBe('https://www.leagueoflegends.com/fr-fr/news/game-updates/patch-notes/');
    });

    it('should convert en-us URL to fr-fr', () => {
      const enUrl = 'https://www.leagueoflegends.com/en-us/news/game-updates/patch-notes/';
      expect(getFrUrl(enUrl)).toBe('https://www.leagueoflegends.com/fr-fr/news/game-updates/patch-notes/');
    });

    it('should convert en URL to fr-fr', () => {
      const enUrl = 'https://www.leagueoflegends.com/en/news/game-updates/patch-notes/';
      expect(getFrUrl(enUrl)).toBe('https://www.leagueoflegends.com/fr-fr/news/game-updates/patch-notes/');
    });
  });

  describe('getEnUrl', () => {
    it('should convert fr-fr URL to en-gb', () => {
      const frUrl = 'https://www.leagueoflegends.com/fr-fr/news/game-updates/patch-notes/';
      expect(getEnUrl(frUrl)).toBe('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-notes/');
    });

    it('should convert fr URL to en-gb', () => {
      const frUrl = 'https://www.leagueoflegends.com/fr/news/game-updates/patch-notes/';
      expect(getEnUrl(frUrl)).toBe('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-notes/');
    });
  });

  describe('isValidPatchUrl', () => {
    it('should validate leagueoflegends.com URLs', () => {
      expect(isValidPatchUrl('https://www.leagueoflegends.com/en-gb/news/game-updates/patch-notes/')).toBe(true);
    });

    it('should validate leagueoflegends.com without www', () => {
      expect(isValidPatchUrl('https://leagueoflegends.com/en-gb/news/game-updates/patch-notes/')).toBe(true);
    });

    it('should reject invalid domains', () => {
      expect(isValidPatchUrl('https://example.com/patch-notes/')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidPatchUrl('not-a-url')).toBe(false);
    });
  });

  describe('parsePatchDate', () => {
    it('should parse ISO date format', () => {
      expect(parsePatchDate('2025-05-28')).toBe('2025-05-28T00:00:00.000Z');
    });

    it('should parse US format', () => {
      expect(parsePatchDate('May 28, 2025')).toBe('2025-05-28T00:00:00.000Z');
    });

    it('should parse European format', () => {
      expect(parsePatchDate('28 May 2025')).toBe('2025-05-28T00:00:00.000Z');
    });

    it('should parse French format', () => {
      expect(parsePatchDate('28 mai 2025')).toBe('2025-05-28T00:00:00.000Z');
    });

    it('should return null for invalid date', () => {
      expect(parsePatchDate('not a date')).toBe(null);
    });
  });
});
