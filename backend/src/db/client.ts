import { AsyncLocalStorage } from "node:async_hooks";
import postgres, { type Options, type PostgresType, type Sql } from "postgres";

function parseBigIntToNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`BIGINT out of JS safe integer range: ${value}`);
  }
  return parsed;
}

let sqlInstance: Sql | null = null;
/** Client imposé à une portée async (réagrégation dans les tables fantômes). */
const scopedSql = new AsyncLocalStorage<Sql>();

const SYNC_COMMIT_OFF = "-c synchronous_commit=off";

type ClientOptions = Options<Record<string, PostgresType>>;

function baseOptions(): ClientOptions {
  return {
    max: 20,
    connection: { options: SYNC_COMMIT_OFF },
    types: {
      bigint: {
        to: 20,
        from: [20],
        parse: parseBigIntToNumber,
        serialize: (value: number): string => String(value),
      },
    },
  };
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  return url;
}

function createSql(): Sql {
  return postgres(databaseUrl(), baseOptions());
}

/** Options d'un client dont les noms non qualifiés vont d'abord dans `schema`, puis dans public. */
export function scopedClientOptions(schema: string): ClientOptions {
  const base = baseOptions();
  return { ...base, max: 4, connection: { ...base.connection, search_path: `${schema},public` } };
}

/** Client dédié à `schema` (à fermer avec `.end()`). */
export function createSchemaSqlClient(schema: string): Sql {
  return postgres(databaseUrl(), scopedClientOptions(schema));
}

/** Pendant `fn` (et ce qu'elle lance), `sql` utilise `client`. */
export function withSqlClient<T>(client: Sql, fn: () => Promise<T>): Promise<T> {
  return scopedSql.run(client, fn);
}

function getSql(): Sql {
  const scoped = scopedSql.getStore();
  if (scoped) return scoped;
  if (!sqlInstance) {
    sqlInstance = createSql();
  }
  return sqlInstance;
}

/** Lazy postgres client — only connects when first used. */
export const sql: Sql = new Proxy(((...args: unknown[]) => {
  return (getSql() as (...params: unknown[]) => unknown)(...args);
}) as unknown as Sql, {
  apply(_target, _thisArg, argArray) {
    return (getSql() as (...params: unknown[]) => unknown)(...argArray);
  },
  get(_target, prop) {
    const client = getSql() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export async function healthCheck(): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) {
    return false;
  }

  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
