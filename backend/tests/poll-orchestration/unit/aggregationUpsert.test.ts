import { describe, expect, it } from 'vitest';
import { buildAdditiveUpsertSql } from '../../../src/workers/aggregationUpsert.js';

describe('buildAdditiveUpsertSql', () => {
  it('returns null when there are no rows', () => {
    expect(
      buildAdditiveUpsertSql({ table: 't', keyColumns: ['a'], sumColumns: ['count_game'], rows: [] }),
    ).toBeNull();
  });

  it('builds a single multi-row insert with one tuple per distinct key', () => {
    const built = buildAdditiveUpsertSql({
      table: 'champion_runes_solo_stats',
      keyColumns: ['champion_id', 'perk_id'],
      sumColumns: ['count_game', 'count_win'],
      rows: [
        { keys: [1, 8005], sums: [1, 1] },
        { keys: [1, 9101], sums: [1, 0] },
      ],
    })!;
    expect(built.params).toEqual([1, 8005, 1, 1, 1, 9101, 1, 0]);
    expect(built.query).toContain('INSERT INTO champion_runes_solo_stats (champion_id, perk_id, count_game, count_win)');
    expect(built.query).toContain('VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)');
    expect(built.query).toContain('ON CONFLICT (champion_id, perk_id) DO UPDATE SET');
    expect(built.query).toContain('count_game = champion_runes_solo_stats.count_game + EXCLUDED.count_game');
    expect(built.query).toContain('count_win = champion_runes_solo_stats.count_win + EXCLUDED.count_win');
  });

  it('pre-aggregates duplicate conflict keys by summing', () => {
    const built = buildAdditiveUpsertSql({
      table: 't',
      keyColumns: ['champion_id'],
      sumColumns: ['count_game', 'count_win', 'sum_ts'],
      rows: [
        { keys: [42], sums: [1, 1, 100] },
        { keys: [42], sums: [1, 0, 250] },
        { keys: [7], sums: [1, 1, 5] },
      ],
    })!;
    // Two distinct keys → two tuples.
    expect(built.query).toContain('VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)');
    // key 42 merged: count_game=2, count_win=1, sum_ts=350
    expect(built.params).toEqual([42, 2, 1, 350, 7, 1, 1, 5]);
  });

  it('optionally appends updated_at = NOW()', () => {
    const built = buildAdditiveUpsertSql({
      table: 't',
      keyColumns: ['a'],
      sumColumns: ['count_game'],
      rows: [{ keys: ['x'], sums: [1] }],
      touchUpdatedAt: true,
    })!;
    expect(built.query).toContain('updated_at = NOW()');
  });

  it('throws on row shape mismatch', () => {
    expect(() =>
      buildAdditiveUpsertSql({
        table: 't',
        keyColumns: ['a', 'b'],
        sumColumns: ['count_game'],
        rows: [{ keys: [1], sums: [1] }],
      }),
    ).toThrow(/shape mismatch/);
  });
});
