import { describe, it, expect } from 'vitest';
import { inferNumericChangeType, isLowerIsBetterStat } from '../../src/scraper/changeType.js';

describe('changeType', () => {
  it('should treat lower cooldown as a buff', () => {
    expect(
      inferNumericChangeType('5 sec', '4 sec', 'Délai de récupération par ennemi')
    ).toBe('buff');
  });

  it('should treat higher cooldown as a nerf', () => {
    expect(
      inferNumericChangeType('4 sec', '5 sec', 'Délai de récupération par ennemi')
    ).toBe('nerf');
  });

  it('should treat higher damage as a buff', () => {
    expect(inferNumericChangeType('100', '120', 'Dégâts')).toBe('buff');
  });

  it('should treat lower damage reduction values as a nerf', () => {
    expect(
      inferNumericChangeType(
        '75 - 255 (Level 1 - 18)',
        '50 - 194 (Level 1 - 18)',
        'Blue Bubble Damage Reduction'
      )
    ).toBe('nerf');
  });

  it('should detect cooldown stats from French labels', () => {
    expect(isLowerIsBetterStat('Délai de récupération par ennemi')).toBe(true);
    expect(isLowerIsBetterStat('Blue Bubble Damage Reduction')).toBe(false);
  });
});
