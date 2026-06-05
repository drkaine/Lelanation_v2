import { describe, it, expect } from 'vitest';
import { parsePatchHtml } from '../../src/scraper/parser.js';

describe('text-only changes', () => {
  const html = `
    <div id="patch-notes-container">
      <h2 id="patch-items">Objets</h2>
      <h3 class="change-title" id="patch-Imperial-Mandate">Mandat impérial</h3>
      <ul>
        <li>&nbsp; SUPPRIMÉ &nbsp; &nbsp; Unique – Tir coordonné</li>
        <li>&nbsp; NOUVEAU &nbsp; &nbsp; Unique – Contrôle : vous gagnez 15 accélération de compétence.</li>
      </ul>
    </div>
  `;

  const htmlEn = `
    <div id="patch-notes-container">
      <h2 id="patch-items">Items</h2>
      <h3 class="change-title" id="patch-Imperial-Mandate">Imperial Mandate</h3>
      <ul>
        <li>&nbsp; REMOVED &nbsp; &nbsp; Unique - Coordinated Fire</li>
        <li>&nbsp; NEW &nbsp; &nbsp; Unique - Control : Gain 15 Ability Haste for your abilities with Immobilizing effects</li>
      </ul>
    </div>
  `;

  it('should parse SUPPRIMÉ and NOUVEAU in French', () => {
    const entities = parsePatchHtml(html, 'fr-FR');
    const mandate = entities.find((e) => e.name === 'Mandat impérial');
    expect(mandate?.changes).toHaveLength(2);

    expect(mandate!.changes[0]).toMatchObject({
      stat: 'Unique – Tir coordonné',
      type: 'removed',
      after: '(supprimé)',
    });

    expect(mandate!.changes[1]).toMatchObject({
      stat: 'Unique – Contrôle',
      type: 'new',
      before: '(nouveau)',
      after: 'vous gagnez 15 accélération de compétence.',
    });
  });

  it('should parse REMOVED and NEW in English', () => {
    const entities = parsePatchHtml(htmlEn, 'en-GB');
    const mandate = entities.find((e) => e.name === 'Imperial Mandate');
    expect(mandate?.changes).toHaveLength(2);

    expect(mandate!.changes[0]).toMatchObject({
      stat: 'Unique - Coordinated Fire',
      type: 'removed',
      after: '(removed)',
    });

    expect(mandate!.changes[1]).toMatchObject({
      stat: 'Unique - Control',
      type: 'new',
      before: '(new)',
    });
  });
});
