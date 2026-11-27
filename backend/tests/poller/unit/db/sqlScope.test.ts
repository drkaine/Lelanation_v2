import { describe, expect, it, vi } from 'vitest';
import type { Sql } from 'postgres';
import { scopedClientOptions, sql, withSqlClient } from '../../../../src/db/client.js';

function fakeClient(calls: string[]): Sql {
  const fn = vi.fn((strings: TemplateStringsArray) => {
    calls.push(strings.join('?'));
    return Promise.resolve([]);
  });
  return Object.assign(fn, { begin: vi.fn(async () => 'begun') }) as unknown as Sql;
}

describe('client sql à portée (tables fantômes)', () => {
  it('dans withSqlClient, `sql` et `sql.begin` vont au client donné', async () => {
    const calls: string[] = [];
    const client = fakeClient(calls);
    const out = await withSqlClient(client, async () => {
      await sql`SELECT 1`;
      await Promise.resolve();
      await sql`SELECT 2`;
      return sql.begin(async () => 'x');
    });
    expect(calls).toEqual(['SELECT 1', 'SELECT 2']);
    expect(out).toBe('begun');
  });

  it('options : search_path du schéma puis public, réglages du client principal gardés', () => {
    const opts = scopedClientOptions('agg_shadow');
    expect(opts.connection).toMatchObject({ search_path: 'agg_shadow,public', options: '-c synchronous_commit=off' });
    expect(opts.max).toBeLessThanOrEqual(5);
  });
});
