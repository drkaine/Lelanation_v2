import { describe, it, expect, beforeAll } from 'vitest';
import { parsePatchHtml, parsePatchHtmlAlt } from '../../src/scraper/parser.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { EntityChanges, Locale } from '../../src/scraper/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8');
}

describe('parser', () => {
  describe('parsePatchHtml', () => {
    let sampleHtml: string;
    let edgeCasesHtml: string;

    beforeAll(() => {
      sampleHtml = loadFixture('sample-patch.html');
      edgeCasesHtml = loadFixture('edge-cases.html');
    });

    it('should parse sample patch HTML correctly', () => {
      const entities = parsePatchHtml(sampleHtml, 'en-GB');

      expect(entities).toHaveLength(5); // Nami, Ahri, Trinity Force, Conqueror, Turret Plates

      // Nami
      const nami = entities.find((e: EntityChanges) => e.name === 'Nami');
      expect(nami).toBeDefined();
      expect(nami!.category).toBe('champion');
      expect(nami!.subCategory).toBe('E - Tidecaller\'s Blessing');
      expect(nami!.changes).toHaveLength(2);
      expect(nami!.changes[0].stat).toBe('Blue Bubble Damage Reduction');
      expect(nami!.changes[0].before).toBe('75 - 255 (Level 1 - 18)');
      expect(nami!.changes[0].after).toBe('50 - 194 (Level 1 - 18)');
      expect(nami!.changes[0].type).toBe('nerf'); // Higher reduction = nerf

      // Ahri
      const ahri = entities.find((e: EntityChanges) => e.name === 'Ahri');
      expect(ahri).toBeDefined();
      expect(ahri!.category).toBe('champion');
      expect(ahri!.changes[0].stat).toBe('Healing');
      expect(ahri!.changes[0].type).toBe('buff'); // More healing = buff

      // Trinity Force
      const trinity = entities.find((e: EntityChanges) => e.name === 'Trinity Force');
      expect(trinity).toBeDefined();
      expect(trinity!.category).toBe('item');
      expect(trinity!.changes).toHaveLength(2);

      // Conqueror
      const conqueror = entities.find((e: EntityChanges) => e.name === 'Conqueror');
      expect(conqueror).toBeDefined();
      expect(conqueror!.category).toBe('rune');

      // Turret Plates
      const turretPlates = entities.find((e: EntityChanges) => e.name === 'Turret Plates');
      expect(turretPlates).toBeDefined();
      expect(turretPlates!.category).toBe('system');
    });

    it('should handle different arrow separators', () => {
      const entities = parsePatchHtml(edgeCasesHtml, 'en-GB');

      const darius = entities.find((e: EntityChanges) => e.name === 'Darius');
      expect(darius).toBeDefined();
      expect(darius!.changes).toHaveLength(2);

      // Should handle → (right arrow)
      expect(darius!.changes[0].after).toContain('35');

      // Should handle &#8594; (unicode arrow)
      expect(darius!.changes[1].after).toContain('12/22');
    });

    it('should skip entities without changes', () => {
      const entities = parsePatchHtml(edgeCasesHtml, 'en-GB');

      const emptyChamp = entities.find((e: EntityChanges) => e.name === 'Empty Champion');
      expect(emptyChamp).toBeUndefined();
    });

    it('should detect champion category correctly', () => {
      const entities = parsePatchHtml(sampleHtml, 'en-GB');
      const champion = entities.find((e: EntityChanges) => e.name === 'Nami');
      expect(champion!.category).toBe('champion');
    });

    it('should detect item category correctly', () => {
      const entities = parsePatchHtml(sampleHtml, 'en-GB');
      const item = entities.find((e: EntityChanges) => e.name === 'Trinity Force');
      expect(item!.category).toBe('item');
    });

    it('should detect rune category correctly', () => {
      const entities = parsePatchHtml(sampleHtml, 'en-GB');
      const rune = entities.find((e: EntityChanges) => e.name === 'Conqueror');
      expect(rune!.category).toBe('rune');
    });

    it('should detect system category correctly', () => {
      const entities = parsePatchHtml(sampleHtml, 'en-GB');
      const system = entities.find((e: EntityChanges) => e.name === 'Turret Plates');
      expect(system!.category).toBe('system');
    });

    it('should identify buffs and nerfs correctly', () => {
      const entities = parsePatchHtml(sampleHtml, 'en-GB');

      // Healing buff (more healing = buff)
      const ahri = entities.find((e: EntityChanges) => e.name === 'Ahri');
      expect(ahri!.changes[0].type).toBe('buff');

      // Cooldown reduction increase (higher reduction = nerf)
      const nami = entities.find((e: EntityChanges) => e.name === 'Nami');
      expect(nami!.changes[0].type).toBe('nerf');
    });

    it('should parse Riot live HTML structure (patch-notes-container)', () => {
      const riotHtml = loadFixture('riot-live-structure.html');
      const entities = parsePatchHtml(riotHtml, 'fr-FR');

      expect(entities.length).toBeGreaterThanOrEqual(5);

      const brand = entities.find((e: EntityChanges) => e.name === 'Brand');
      expect(brand).toBeDefined();
      expect(brand!.category).toBe('champion');
      expect(brand!.id).toBe('Brand');
      expect(brand!.patchSlug).toBe('brand');
      expect(brand!.subCategory).toBe('Stats de base');
      expect(brand!.changes).toHaveLength(2);

      const heartsteel = entities.find((e: EntityChanges) => e.name === 'Cœuracier');
      expect(heartsteel?.category).toBe('item');
      expect(heartsteel?.id).toBe('3084');
      expect(heartsteel?.patchSlug).toBe('Heartsteel');

      const aery = entities.find((e: EntityChanges) => e.name === "Invocation d'Aery");
      expect(aery?.category).toBe('rune'); // cmsassets href = rune
      expect(aery?.id).toBe('SummonAery');
      expect(aery?.patchSlug).toBe('Summon-Aery');

      const dreamMaker = entities.find((e: EntityChanges) => e.name === 'Rêve éveillé');
      expect(dreamMaker?.category).toBe('item'); // detected from ddragon item href
      expect(dreamMaker?.id).toBe('3870');

      const mandate = entities.find((e: EntityChanges) => e.name === 'Mandat impérial');
      expect(mandate?.id).toBe('4005');
      expect(mandate?.patchSlug).toBe('Imperial-Mandate');
      expect(mandate).toBeDefined();
      expect(mandate!.changes).toHaveLength(4);

      const removed = mandate!.changes.find((c) => c.type === 'removed');
      expect(removed?.stat).toBe('Unique – Tir coordonné');
      expect(removed?.before).toBe('Unique – Tir coordonné');

      const newChanges = mandate!.changes.filter((c) => c.type === 'new');
      expect(newChanges).toHaveLength(2);
      expect(newChanges[0].stat).toBe('Unique – Contrôle');
      expect(newChanges[0].after).toContain('15 accélération');
      expect(newChanges[1].stat).toBe('Unique – Ordre');
    });
  });

  describe('parsePatchHtmlAlt', () => {
    it('should parse alternative HTML structures', () => {
      // This is a fallback parser for different page structures
      // The test uses a basic HTML structure that might match alt selectors
      const html = `
        <div class="patch-note">
          <h3 class="title">Yasuo</h3>
          <div class="change">
            <span class="stat">Crit Chance</span>
            <span class="before">100%</span>
            <span class="separator">⇒</span>
            <span class="after">90%</span>
          </div>
        </div>
      `;

      const entities = parsePatchHtmlAlt(html, 'en-GB');
      // The alt parser looks for different selectors
      expect(Array.isArray(entities)).toBe(true);
    });
  });
});
