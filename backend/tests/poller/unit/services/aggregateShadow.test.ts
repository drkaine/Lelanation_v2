import { describe, expect, it, vi } from 'vitest';
import {
  SHADOW_SCHEMA,
  buildShadowDdl,
  buildSwapDdl,
  runShadowReaggregation,
  type AggregateTableCatalog,
  type ShadowReaggregationDeps,
} from '../../../../src/services/aggregateShadow.js';

const partitioned: AggregateTableCatalog = {
  name: 'champion_stats',
  partitionKey: 'LIST (patch)',
  partitions: [{ name: 'champion_stats_p_default', bound: 'DEFAULT' }],
  constraints: [{ name: 'champion_stats_pkey', def: 'PRIMARY KEY (patch, role)' }],
  indexes: [{ name: 'champion_stats_patch_idx', def: 'CREATE INDEX champion_stats_patch_idx ON ONLY public.champion_stats USING btree (patch)' }],
};
const plain: AggregateTableCatalog = {
  name: 'match_aggregated',
  partitionKey: null,
  partitions: [],
  constraints: [{ name: 'match_aggregated_pkey', def: 'PRIMARY KEY (riot_match_id)' }],
  indexes: [{ name: 'match_aggregated_at_idx', def: 'CREATE INDEX match_aggregated_at_idx ON public.match_aggregated USING btree (at)' }],
};

describe('tables fantômes : DDL', () => {
  it('schéma recréé, tables copiées sans index, partitions, contraintes et index aux mêmes noms', () => {
    const ddl = buildShadowDdl([partitioned, plain]);
    expect(ddl[0]).toBe(`DROP SCHEMA IF EXISTS ${SHADOW_SCHEMA} CASCADE`);
    expect(ddl[1]).toBe(`CREATE SCHEMA ${SHADOW_SCHEMA}`);
    expect(ddl).toContain(
      'CREATE TABLE agg_shadow.champion_stats (LIKE public.champion_stats INCLUDING ALL EXCLUDING INDEXES) PARTITION BY LIST (patch)',
    );
    expect(ddl).toContain('CREATE TABLE agg_shadow.champion_stats_p_default PARTITION OF agg_shadow.champion_stats DEFAULT');
    expect(ddl).toContain('ALTER TABLE agg_shadow.champion_stats ADD CONSTRAINT champion_stats_pkey PRIMARY KEY (patch, role)');
    expect(ddl).toContain('CREATE INDEX champion_stats_patch_idx ON agg_shadow.champion_stats USING btree (patch)');
    expect(ddl).toContain('CREATE TABLE agg_shadow.match_aggregated (LIKE public.match_aggregated INCLUDING ALL EXCLUDING INDEXES)');
    expect(ddl).toContain('CREATE INDEX match_aggregated_at_idx ON agg_shadow.match_aggregated USING btree (at)');
    // partitions créées avant les contraintes (propagées aux partitions)
    const part = ddl.findIndex((s) => s.includes('PARTITION OF'));
    const pk = ddl.findIndex((s) => s.includes('champion_stats_pkey'));
    expect(part).toBeLessThan(pk);
  });

  it('bascule : anciennes tables et partitions sorties, fantômes dans public, anciennes supprimées', () => {
    const ddl = buildSwapDdl([partitioned, plain]);
    expect(ddl).toEqual([
      'DROP SCHEMA IF EXISTS agg_old CASCADE',
      'CREATE SCHEMA agg_old',
      'ALTER TABLE public.champion_stats SET SCHEMA agg_old',
      'ALTER TABLE public.champion_stats_p_default SET SCHEMA agg_old',
      'ALTER TABLE agg_shadow.champion_stats SET SCHEMA public',
      'ALTER TABLE agg_shadow.champion_stats_p_default SET SCHEMA public',
      'ALTER TABLE public.match_aggregated SET SCHEMA agg_old',
      'ALTER TABLE agg_shadow.match_aggregated SET SCHEMA public',
      'DROP SCHEMA agg_old CASCADE',
      'DROP SCHEMA agg_shadow CASCADE',
    ]);
  });

  it('nom de table invalide refusé (DDL non paramétrable)', () => {
    expect(() => buildShadowDdl([{ ...plain, name: 'x; DROP TABLE y' }])).toThrow(/identifier/);
  });
});

describe('réagrégation par tables fantômes', () => {
  function deps(passes: number[], catchUp: number[], over: Partial<ShadowReaggregationDeps> = {}) {
    const events: string[] = [];
    let locked = false;
    const d: ShadowReaggregationDeps = {
      batchLimit: 10,
      setupShadow: vi.fn(async () => {
        events.push(`setup locked=${locked}`);
      }),
      runShadowPass: vi.fn(async () => {
        const queue = locked ? catchUp : passes;
        const candidates = queue.shift() ?? 0;
        events.push(`pass locked=${locked} c=${candidates}`);
        return { candidates, aggregated: candidates, skippedNotReady: 0, failed: 0 };
      }),
      withLock: async (fn) => {
        locked = true;
        try {
          return { ran: true, value: await fn(async () => true) };
        } finally {
          locked = false;
        }
      },
      swap: vi.fn(async () => {
        events.push(`swap locked=${locked}`);
      }),
      dropShadow: vi.fn(async () => {
        events.push('drop');
      }),
      ...over,
    };
    return { d, events };
  }

  it('construction hors verrou, rattrapage et bascule sous verrou', async () => {
    const { d, events } = deps([10, 10, 3], [10, 2]);
    const total = await runShadowReaggregation(d);
    expect(total).toBe(35);
    expect(events).toEqual([
      'setup locked=false',
      'pass locked=false c=10',
      'pass locked=false c=10',
      'pass locked=false c=3',
      'pass locked=true c=10',
      'pass locked=true c=2',
      'swap locked=true',
    ]);
  });

  it('verrou non obtenu : pas de bascule, schéma fantôme supprimé, erreur', async () => {
    const { d, events } = deps([1], [], { withLock: async () => ({ ran: false }) });
    await expect(runShadowReaggregation(d)).rejects.toThrow('aggregation_lock_busy');
    expect(d.swap).not.toHaveBeenCalled();
    expect(events.at(-1)).toBe('drop');
  });

  it('échec de construction : public intact, fantôme supprimé', async () => {
    const { d } = deps([], [], {
      runShadowPass: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    await expect(runShadowReaggregation(d)).rejects.toThrow('boom');
    expect(d.swap).not.toHaveBeenCalled();
    expect(d.dropShadow).toHaveBeenCalled();
  });
});
