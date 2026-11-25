import { describe, expect, it } from 'vitest';
import { SweepGate } from '../../../../src/poll-orchestration/sweepGate.js';

describe('SweepGate — pause par plateforme pendant le balayage des rangs', () => {
  it('bloque dès le démarrage tant qu’un balayage actif n’a pas dit idle', () => {
    const gate = new SweepGate(['euw1']);
    expect(gate.activePlatforms(['euw1'])).toEqual([]);
    expect(gate.allHeld(['euw1'])).toBe(true);
    gate.record('euw1', 'idle');
    expect(gate.activePlatforms(['euw1'])).toEqual(['euw1']);
    expect(gate.allHeld(['euw1'])).toBe(false);
  });

  it('sans balayage (désactivé) : jamais bloqué', () => {
    const gate = new SweepGate([]);
    expect(gate.activePlatforms(['euw1', 'kr'])).toEqual(['euw1', 'kr']);
    expect(gate.allHeld(['euw1', 'kr'])).toBe(false);
  });

  it('une page ou un apex relance la pause (nouveau jour à 00:01)', () => {
    const gate = new SweepGate(['euw1']);
    gate.record('euw1', 'idle');
    gate.record('euw1', 'apex');
    expect(gate.activePlatforms(['euw1'])).toEqual([]);
    gate.record('euw1', 'page');
    expect(gate.allHeld(['euw1'])).toBe(true);
  });

  it('le balayage KR ne met en pause que KR : EUW continue', () => {
    const gate = new SweepGate(['euw1', 'kr']);
    gate.record('euw1', 'idle');
    expect(gate.activePlatforms(['euw1', 'kr'])).toEqual(['euw1']);
    expect(gate.allHeld(['euw1', 'kr'])).toBe(false);
    gate.record('kr', 'idle');
    expect(gate.activePlatforms(['euw1', 'kr'])).toEqual(['euw1', 'kr']);
  });
});
