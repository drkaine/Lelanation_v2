import { describe, expect, it } from 'vitest';
import {
  EMPTY_TIMELINE,
  allowedPollerPlatforms,
  filterAllowedMatchIds,
  isAllowedRegion,
  toDbRegions,
  isEarlySurrenderMatch,
} from '../../../../src/poller/utils/pollerScope.js';

describe('isEarlySurrenderMatch', () => {
  it('vrai si un participant a gameEndedInEarlySurrender', () => {
    const match = { info: { participants: [{ gameEndedInEarlySurrender: false }, { gameEndedInEarlySurrender: true }] } };
    expect(isEarlySurrenderMatch(match)).toBe(true);
  });

  it('faux pour une partie normale ou sans participants', () => {
    expect(isEarlySurrenderMatch({ info: { participants: [{ gameEndedInEarlySurrender: false }] } })).toBe(false);
    expect(isEarlySurrenderMatch({})).toBe(false);
  });

  it('timeline vide sans frames', () => {
    expect(EMPTY_TIMELINE.info?.frames).toEqual([]);
  });
});

describe('allowedPollerPlatforms', () => {
  it('défaut : EUW1 et KR', () => {
    expect(allowedPollerPlatforms(undefined)).toEqual(['euw1', 'kr']);
    expect(allowedPollerPlatforms('  ')).toEqual(['euw1', 'kr']);
  });

  it('lit une liste séparée par virgules, ignore les inconnues', () => {
    expect(allowedPollerPlatforms('EUW1, eun1,foo')).toEqual(['euw1', 'eun1']);
  });
});

describe('filterAllowedMatchIds', () => {
  it('garde seulement les matchs des plateformes autorisées', () => {
    const ids = ['EUW1_1', 'ME1_2', 'TR1_3', 'EUW1_4', 'garbage'];
    expect(filterAllowedMatchIds(ids, ['euw1'])).toEqual(['EUW1_1', 'EUW1_4']);
  });

  it('isAllowedRegion compares DB region (any case) to allowed platforms', () => {
    expect(isAllowedRegion('EUW1', ['euw1'])).toBe(true);
    expect(isAllowedRegion(' euw1 ', ['euw1'])).toBe(true);
    expect(isAllowedRegion('TR1', ['euw1'])).toBe(false);
    expect(isAllowedRegion(null, ['euw1'])).toBe(false);
  });

  it('toDbRegions uppercases platforms for lol_region', () => {
    expect(toDbRegions(['euw1', 'eun1'])).toEqual(['EUW1', 'EUN1']);
  });
});
