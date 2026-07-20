import { describe, expect, it } from 'vitest';
import { mergeOrderItemsJson } from '../../../src/parsers/purchaseOrderItemsJson.js';

describe('mergeOrderItemsJson', () => {
  it('returns an empty object when both inputs are empty', () => {
    expect(mergeOrderItemsJson({}, {})).toEqual({});
  });

  it('keeps disjoint items from both sides', () => {
    const merged = mergeOrderItemsJson(
      { '1055': { games: 1, wins: 1 } },
      { '3031': { games: 1, wins: 0 } },
    );
    expect(merged).toEqual({
      '1055': { games: 1, wins: 1 },
      '3031': { games: 1, wins: 0 },
    });
  });

  it('sums games and wins for overlapping items', () => {
    const merged = mergeOrderItemsJson(
      { '1055': { games: 2, wins: 1 } },
      { '1055': { games: 3, wins: 2 } },
    );
    expect(merged).toEqual({ '1055': { games: 5, wins: 3 } });
  });

  it('does not mutate the inputs', () => {
    const a = { '1055': { games: 1, wins: 1 } };
    const b = { '1055': { games: 1, wins: 1 } };
    mergeOrderItemsJson(a, b);
    expect(a).toEqual({ '1055': { games: 1, wins: 1 } });
    expect(b).toEqual({ '1055': { games: 1, wins: 1 } });
  });
});
