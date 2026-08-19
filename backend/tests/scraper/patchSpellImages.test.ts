import { describe, it, expect } from 'vitest';
import {
  parseSpellSubCategory,
  resolveSpellImageFile,
  buildSpellRemoteImageUrl,
} from '../../src/scraper/patchSpellImages.js';

describe('patchSpellImages', () => {
  it('parses french classic spell headings', () => {
    expect(parseSpellSubCategory('A - Jet de bandelette')).toEqual({
      slot: 'Q',
      name: 'Jet de bandelette',
    });
    expect(parseSpellSubCategory('Z - Tir vicié')).toEqual({
      slot: 'W',
      name: 'Tir vicié',
    });
    expect(parseSpellSubCategory('Compétence passive - Toucher maudit')).toEqual({
      slot: 'passive',
      name: 'Toucher maudit',
    });
    expect(parseSpellSubCategory('Passif - Énergisé')).toEqual({
      slot: 'passive',
      name: 'Énergisé',
    });
    expect(parseSpellSubCategory('Stats de base')).toBeNull();
  });

  it('resolves spell image files from champion data', () => {
    const champion = {
      passive: { name: 'Toucher maudit', image: { full: 'Amumu_Passive.png' } },
      spells: [
        { slot: 'Q', name: 'Jet de bandelette', image: { full: 'BandageToss.png' } },
        { slot: 'W', name: 'Désespoir', image: { full: 'AuraofDespair.png' } },
      ],
    };

    expect(
      resolveSpellImageFile(champion, parseSpellSubCategory('A - Jet de bandelette')!)
    ).toBe('BandageToss.png');
    expect(
      resolveSpellImageFile(champion, parseSpellSubCategory('Compétence passive - Toucher maudit')!)
    ).toBe('Amumu_Passive.png');
  });

  it('builds ddragon spell urls', () => {
    expect(
      buildSpellRemoteImageUrl('16.16.1', { slot: 'Q', name: 'Bandage Toss' }, 'BandageToss.png')
    ).toBe('https://ddragon.leagueoflegends.com/cdn/16.16.1/img/spell/BandageToss.png');
    expect(
      buildSpellRemoteImageUrl('16.16.1', { slot: 'passive', name: 'Curse' }, 'Amumu_Passive.png')
    ).toBe('https://ddragon.leagueoflegends.com/cdn/16.16.1/img/passive/Amumu_Passive.png');
  });
});
