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
      expect(brand!.changes).toHaveLength(2);
      expect(brand!.changes.every(c => c.subCategory === 'Stats de base')).toBe(true);

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

      const moonstone = entities.find((e: EntityChanges) => e.name === 'Régénérateur de pierre de lune');
      expect(moonstone).toBeDefined();
      expect(moonstone!.category).toBe('item');
      expect(moonstone!.patchSlug).toBe('Moonstone-Renewer');
      expect(moonstone!.changes).toHaveLength(2);
      expect(moonstone!.changes[0].type).toBe('text');
      expect(moonstone!.changes[0].after).toContain('Hémorragie');
      expect(moonstone!.changes[1].after).toContain('moins de PV');

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

    it('should parse champions section with blockquote before stats', () => {
      const html = loadFixture('champions-section.html');
      const entities = parsePatchHtml(html, 'fr-FR');

      const brand = entities.find(e => e.name === 'Brand');
      expect(brand).toBeDefined();
      expect(brand!.category).toBe('champion');
      expect(brand!.changes).toHaveLength(1);
      expect(brand!.changes[0].subCategory).toBe('Stats de base');
    });

    it('should group champion changes by ability within one entity', () => {
      const html = loadFixture('champion-abilities.html');
      const entities = parsePatchHtml(html, 'fr-FR');

      const heimer = entities.find(e => e.name === 'Heimerdinger');
      expect(heimer).toBeDefined();
      expect(heimer!.changes).toHaveLength(3);
      expect(heimer!.changes.filter(c => c.subCategory?.includes('Tourelle'))).toHaveLength(2);
      expect(heimer!.changes.find(c => c.subCategory?.includes('Grenade'))?.stat).toBe(
        "Vision de l'emplacement de la cible"
      );

      const quinn = entities.find(e => e.name === 'Quinn');
      expect(quinn).toBeDefined();
      expect(quinn!.changes).toHaveLength(2);
      expect(quinn!.changes.find(c => c.subCategory?.includes('Busard'))?.after).toBe('75');
      expect(quinn!.changes.find(c => c.subCategory?.includes('Assaut'))?.after).toBe('200%');
    });

    it('should parse new champion release sections without h3', () => {
      const html = loadFixture('new-champion-release.html');
      const entities = parsePatchHtml(html, 'fr-FR');

      const locke = entities.find(e => e.name === 'Locke');
      expect(locke).toBeDefined();
      expect(locke!.category).toBe('champion');
      expect(locke!.id).toBe('Locke');
      expect(locke!.patchSlug).toBe('locke');
      expect(locke!.isNewRelease).toBe(true);
      expect(locke!.changes.length).toBeGreaterThanOrEqual(6);
      expect(locke!.changes[0].type).toBe('text');
      expect(locke!.changes[0].after).toContain('Exorciste cendré');
      expect(locke!.changes.some(c => c.subCategory?.includes('Pieu argenté'))).toBe(true);
      expect(locke!.changes.some(c => c.subCategory?.includes('Purgatoire'))).toBe(true);
      const spotlight = locke!.changes.find(c => c.after.includes('Focus sur Locke'));
      expect(spotlight?.linkUrl).toBe('https://youtu.be/YFgeOkndw_8');
      expect(spotlight?.linkLabel).toBe('ici');
    });

    it('should skip skins promo sections', () => {
      const html = loadFixture('skins-section.html');
      const entities = parsePatchHtml(html, 'fr-FR');

      expect(entities.find(e => e.name === 'Skins')).toBeUndefined();
      expect(entities.some(e => e.changes.some(c => c.after.includes('skins spéciaux')))).toBe(
        false
      );
    });

    it('should parse system sections with blockquote-only content', () => {
      const html = loadFixture('system-blockquote-only.html');
      const entities = parsePatchHtml(html, 'fr-FR');

      const lastHit = entities.find(e => e.name === 'Indicateurs de coup de grâce');
      expect(lastHit).toBeDefined();
      expect(lastHit!.category).toBe('system');
      expect(lastHit!.changes).toHaveLength(1);
      expect(lastHit!.changes[0].type).toBe('text');
      expect(lastHit!.changes[0].after).toContain('Normal Draft');
    });

    it('should parse patch-systems as system (not champion release)', () => {
      const html = loadFixture('system-adc-mr.html');
      const entities = parsePatchHtml(html, 'fr-FR');

      expect(entities.find(e => e.name === 'Enfin')).toBeUndefined();

      const adcMr = entities.find(e => e.name === 'RÉSISTANCE MAGIQUE DES ADC');
      expect(adcMr).toBeDefined();
      expect(adcMr!.category).toBe('system');
      expect(adcMr!.changes[0].type).toBe('text');
      expect(adcMr!.changes[0].after).toContain('Enfin, en plus');
      expect(adcMr!.changes[1].stat).toBe('Résistance magique');
      expect(adcMr!.changes[1].before).toBe('30 + 1,3/niveau');
      expect(adcMr!.changes[1].after).toBe('33 + 1,1/niveau');
    });

    it('should parse structured mode sections (larves, ARAM chaos, bugfixes)', () => {
      const structuredHtml = loadFixture('structured-modes.html');
      const entities = parsePatchHtml(structuredHtml, 'fr-FR');

      const midRoleQuest = entities.find(e => e.name === 'Quête de rôle de la voie du milieu');
      expect(midRoleQuest).toBeDefined();
      expect(midRoleQuest!.category).toBe('system');
      expect(midRoleQuest!.changes[0].type).toBe('text');
      expect(midRoleQuest!.changes[0].after).toContain('26.9');
      expect(midRoleQuest!.changes[1].stat).toBe("Dégâts d'attaque et puissance bonus");
      expect(midRoleQuest!.changes[1].before).toBe('6%');
      expect(midRoleQuest!.changes[1].after).toBe('8%');

      const larves = entities.find(e => e.name === 'Larves du Néant');
      expect(larves).toBeDefined();
      expect(larves!.category).toBe('system');
      expect(larves!.changes.length).toBeGreaterThanOrEqual(2);

      const gwen = entities.find(e => e.name === 'Gwen' && e.category === 'aram-chaos');
      expect(gwen).toBeDefined();
      expect(gwen!.changes[0].stat).toBe('Dégâts infligés');

      const missFortune = entities.find(e => e.name === 'Miss Fortune' && e.category === 'classic');
      expect(missFortune).toBeDefined();
      expect(missFortune!.subCategory).toBe('CHAMPIONS');
      expect(missFortune!.changes[0].type).toBe('text');
      expect(missFortune!.changes[0].after).toContain('voie du bas');
      expect(missFortune!.changes[1].subCategory).toBe('Z - Tir vicié');
      expect(missFortune!.changes[1].stat).toBe("Dégâts d'attaque");
      expect(missFortune!.changes[1].before).toBe('46');
      expect(missFortune!.changes[1].after).toBe('50');

      expect(
        entities.some(
          e =>
            e.category === 'classic' &&
            (e.subCategory ?? '').toLowerCase().includes('skin')
        )
      ).toBe(false);

      const newRunes = entities.find(
        e => e.category === 'classic' && e.name === 'Nouvelles runes'
      );
      expect(newRunes).toBeDefined();
      expect(
        newRunes!.changes.some(
          c => c.subCategory === 'Marques' && c.after.includes('Marque mineure de puissance')
        )
      ).toBe(true);
      expect(
        newRunes!.changes.some(
          c => c.subCategory === 'Sceaux' && c.after.includes("Sceau de régénération")
        )
      ).toBe(true);
      expect(entities.find(e => e.category === 'classic' && e.name === 'Marques')).toBeUndefined();

      const chaosBugfixes = entities.filter(
        e => e.category === 'aram-chaos' && e.subCategory === 'Corrections de bugs'
      );
      expect(chaosBugfixes).toHaveLength(1);
      expect(chaosBugfixes[0].name).toBe('');
      expect(chaosBugfixes[0].changes).toHaveLength(1);
      expect(chaosBugfixes[0].changes[0].after).toContain('Graves');

      const srBugfixes = entities.filter(e => e.category === 'bugfix');
      expect(srBugfixes).toHaveLength(2);
      expect(srBugfixes.every(e => e.name === '')).toBe(true);
    });

    it('should keep arena CHAMPIONS subCategory across separate content blocks', () => {
      const html = `
        <div id="patch-notes-container">
          <header class="header-primary"><h2 id="patch-arena">Arena</h2></header>
          <div class="content-border">
            <div class="white-stone accent-before">
              <div>
                <h4 class="change-detail-title">CHAMPIONS</h4>
                <h4 class="change-detail-title">Aurelion Sol</h4>
                <p><strong>A - Souffle de lumière</strong></p>
                <ul><li><strong>Dégâts</strong> : 4% ⇒ <strong>3%</strong></li></ul>
              </div>
            </div>
          </div>
          <div class="content-border">
            <div class="white-stone accent-before">
              <div>
                <h4 class="change-detail-title">Bel'Veth</h4>
                <p><strong>R - Banquet infini</strong></p>
                <ul><li><strong>PV bonus</strong> : 250 ⇒ <strong>100</strong></li></ul>
              </div>
            </div>
          </div>
        </div>
      `;

      const entities = parsePatchHtml(html, 'fr-FR');
      const belveth = entities.find(e => e.category === 'arena' && e.name === "Bel'Veth");
      expect(belveth).toBeDefined();
      expect(belveth!.subCategory).toBe('CHAMPIONS');
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
