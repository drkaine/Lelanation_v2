import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { loadGameDataIndexes } from '../../src/scraper/gameDataLoader.js';
import { buildGameDataIndexes } from '../../src/scraper/entityIds.js';

describe('gameDataLoader', () => {
  it('should load merged en_US and fr_FR indexes from frontend game data', async () => {
    const langDir = join(process.cwd(), '..', 'frontend', 'public', 'data', 'game', '16.11.1', 'en_US');
    expect(existsSync(langDir)).toBe(true);

    const championsData = JSON.parse(
      await readFile(join(langDir, 'champions', 'index.json'), 'utf-8')
    );
    const itemData = JSON.parse(await readFile(join(langDir, 'item.json'), 'utf-8'));
    const runesData = JSON.parse(await readFile(join(langDir, 'runesReforged.json'), 'utf-8'));
    const manual = buildGameDataIndexes(championsData.champions, itemData.data, runesData);
    expect(manual.itemNameToId.size).toBeGreaterThan(0);

    const indexes = await loadGameDataIndexes('16.11.1');
    expect(indexes).not.toBeNull();
    expect(indexes?.itemNameToId.get("lame d'infini")).toBeTruthy();
    expect(indexes?.championSlugToId.get('maitre yi')).toBe('MasterYi');
  });
});
