import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  extractSummaryImageUrl,
  normalizeCmsImageUrl,
  buildSummaryImageFilename,
  getImageExtension,
} from '../../src/scraper/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

describe('imageExtractor', () => {
  let summaryHtml: string;

  beforeAll(() => {
    summaryHtml = loadFixture('summary-image.html');
  });

  describe('extractSummaryImageUrl', () => {
    it('should extract img src from patch-highlights (not the link href)', () => {
      const result = extractSummaryImageUrl(summaryHtml);

      expect(result).toBeDefined();
      expect(result!.url).toBe(
        'https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/a0d83fc4ddfd9dfccf036f1b1755ecd6af039c05-1920x1080.png'
      );
      expect(result!.width).toBe(1920);
      expect(result!.height).toBe(1080);
    });

    it('should return null when no summary image exists', () => {
      const html = '<html><body><article><h2>No image here</h2></article></body></html>';
      expect(extractSummaryImageUrl(html)).toBeNull();
    });
  });

  describe('normalizeCmsImageUrl', () => {
    it('should strip query params and decode entities', () => {
      const raw = 'https://cmsassets.rgpub.io/sanity/images/foo-1920x1080.png?accountingTag=LoL&amp;w=1200';
      expect(normalizeCmsImageUrl(raw)).toBe(
        'https://cmsassets.rgpub.io/sanity/images/foo-1920x1080.png'
      );
    });
  });

  describe('getImageExtension', () => {
    it('should detect png extension', () => {
      expect(getImageExtension('https://example.com/image-1920x1080.png')).toBe('png');
    });

    it('should default to png', () => {
      expect(getImageExtension('https://example.com/noext')).toBe('png');
    });
  });

  describe('buildSummaryImageFilename', () => {
    it('should build locale-specific filename', () => {
      const url = 'https://cmsassets.rgpub.io/sanity/images/foo-1920x1080.png';
      expect(buildSummaryImageFilename('26.11', 'fr-FR', url)).toBe('patch-26.11-fr-FR-summary.png');
      expect(buildSummaryImageFilename('26.11', 'en-GB', url)).toBe('patch-26.11-en-GB-summary.png');
    });
  });
});
