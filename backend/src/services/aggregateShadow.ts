/**
 * Réagrégation complète dans des tables fantômes (schéma agg_shadow), hors verrou d'agrégation :
 * le batch du poller continue d'écrire dans public pendant la construction. Sous le verrou, une
 * passe de rattrapage (matchs agrégés entre-temps dans public) puis la bascule : tables échangées
 * par SET SCHEMA dans une transaction (renommage, pas de copie : ~2,4 Go d'agrégats).
 */
import type { Sql } from "postgres";
import type { LockResult } from "./aggregationLock.js";

export const SHADOW_SCHEMA = "agg_shadow";
const OLD_SCHEMA = "agg_old";

export interface AggregateTableCatalog {
  name: string;
  /** `pg_get_partkeydef` ; null = table simple. */
  partitionKey: string | null;
  partitions: { name: string; bound: string }[];
  /** Contraintes clé primaire / unique / exclusion (`pg_get_constraintdef`). */
  constraints: { name: string; def: string }[];
  /** Index hors contraintes, `indexdef` de pg_indexes (schéma public). */
  indexes: { name: string; def: string }[];
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`invalid identifier: ${name}`);
  return name;
}

/** DDL des tables fantômes : mêmes colonnes, partitions, contraintes et noms d'index que public. */
export function buildShadowDdl(tables: readonly AggregateTableCatalog[]): string[] {
  const ddl = [`DROP SCHEMA IF EXISTS ${SHADOW_SCHEMA} CASCADE`, `CREATE SCHEMA ${SHADOW_SCHEMA}`];
  for (const t of tables) {
    const name = ident(t.name);
    const shadow = `${SHADOW_SCHEMA}.${name}`;
    const partitionBy = t.partitionKey ? ` PARTITION BY ${t.partitionKey}` : "";
    ddl.push(`CREATE TABLE ${shadow} (LIKE public.${name} INCLUDING ALL EXCLUDING INDEXES)${partitionBy}`);
    for (const p of t.partitions) {
      ddl.push(`CREATE TABLE ${SHADOW_SCHEMA}.${ident(p.name)} PARTITION OF ${shadow} ${p.bound}`);
    }
    for (const c of t.constraints) {
      ddl.push(`ALTER TABLE ${shadow} ADD CONSTRAINT ${ident(c.name)} ${c.def}`);
    }
    for (const i of t.indexes) {
      ident(i.name);
      ddl.push(i.def.replace(new RegExp(` ON (ONLY )?public\\.${name} `), ` ON ${shadow} `));
    }
  }
  return ddl;
}

/** Bascule (une transaction) : anciennes tables vers agg_old, fantômes vers public, anciennes supprimées. */
export function buildSwapDdl(tables: readonly AggregateTableCatalog[]): string[] {
  const ddl = [`DROP SCHEMA IF EXISTS ${OLD_SCHEMA} CASCADE`, `CREATE SCHEMA ${OLD_SCHEMA}`];
  for (const t of tables) {
    const names = [ident(t.name), ...t.partitions.map((p) => ident(p.name))];
    for (const n of names) ddl.push(`ALTER TABLE public.${n} SET SCHEMA ${OLD_SCHEMA}`);
    for (const n of names) ddl.push(`ALTER TABLE ${SHADOW_SCHEMA}.${n} SET SCHEMA public`);
  }
  ddl.push(`DROP SCHEMA ${OLD_SCHEMA} CASCADE`, `DROP SCHEMA ${SHADOW_SCHEMA} CASCADE`);
  return ddl;
}

/** Structure des tables d'agrégats dans public (catalogue Postgres). */
export async function loadAggregateCatalog(
  db: Sql,
  tables: readonly string[],
): Promise<AggregateTableCatalog[]> {
  const rows = await db<
    {
      name: string;
      partition_key: string | null;
      partitions: { name: string; bound: string }[];
      constraints: { name: string; def: string }[];
      indexes: { name: string; def: string }[];
    }[]
  >`
    SELECT c.relname AS name,
      CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) END AS partition_key,
      COALESCE((SELECT json_agg(json_build_object('name', ch.relname, 'bound', pg_get_expr(ch.relpartbound, ch.oid)))
        FROM pg_inherits h JOIN pg_class ch ON ch.oid = h.inhrelid WHERE h.inhparent = c.oid), '[]') AS partitions,
      COALESCE((SELECT json_agg(json_build_object('name', k.conname, 'def', pg_get_constraintdef(k.oid)))
        FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype IN ('p', 'u', 'x')), '[]') AS constraints,
      COALESCE((SELECT json_agg(json_build_object('name', ic.relname, 'def', pg_get_indexdef(ix.indexrelid)))
        FROM pg_index ix JOIN pg_class ic ON ic.oid = ix.indexrelid
        WHERE ix.indrelid = c.oid
          AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = ix.indexrelid)), '[]') AS indexes
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY(${[...tables]}::text[])
  `;
  if (rows.length !== tables.length) {
    const found = new Set(rows.map((r) => r.name));
    throw new Error(`aggregate tables missing: ${tables.filter((t) => !found.has(t)).join(", ")}`);
  }
  return rows.map((r) => ({
    name: r.name,
    partitionKey: r.partition_key,
    partitions: r.partitions,
    constraints: r.constraints,
    indexes: r.indexes,
  }));
}

export interface PassResult {
  candidates: number;
  aggregated: number;
  skippedNotReady: number;
  failed: number;
}

export interface ShadowReaggregationDeps {
  batchLimit: number;
  setupShadow(): Promise<void>;
  /** Une passe de batch d'agrégation écrite dans les tables fantômes. */
  runShadowPass(): Promise<PassResult>;
  withLock<T>(fn: (renew: () => Promise<boolean>) => Promise<T>): Promise<LockResult<T>>;
  swap(): Promise<void>;
  dropShadow(): Promise<void>;
  onPass?(line: string): void;
}

/** Renvoie le nombre de matchs agrégés (construction + rattrapage). */
export async function runShadowReaggregation(d: ShadowReaggregationDeps): Promise<number> {
  let pass = 0;
  const drain = async (renew?: () => Promise<boolean>): Promise<number> => {
    let total = 0;
    for (;;) {
      pass += 1;
      await renew?.();
      const r = await d.runShadowPass();
      total += r.aggregated;
      d.onPass?.(
        `pass=${pass} candidates=${r.candidates} aggregated=${r.aggregated} ` +
          `skipped_not_ready=${r.skippedNotReady} failed=${r.failed}${renew ? " locked" : ""}`,
      );
      if (r.candidates < d.batchLimit) return total;
    }
  };

  let swapped = false;
  try {
    await d.setupShadow();
    const built = await drain();
    const res = await d.withLock(async (renew) => {
      const caughtUp = await drain(renew);
      await d.swap();
      swapped = true;
      return caughtUp;
    });
    if (!res.ran) throw new Error("aggregation_lock_busy");
    return built + res.value;
  } finally {
    if (!swapped) await d.dropShadow();
  }
}
