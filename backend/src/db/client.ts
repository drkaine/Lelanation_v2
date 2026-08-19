import postgres, { type Sql } from "postgres";

function parseBigIntToNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`BIGINT out of JS safe integer range: ${value}`);
  }
  return parsed;
}

let sqlInstance: Sql | null = null;

function createSql(): Sql {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  return postgres(url, {
    max: 20,
    connection: {
      options: "-c synchronous_commit=off",
    },
    types: {
      bigint: {
        to: 20,
        from: [20],
        parse: parseBigIntToNumber,
        serialize: (value: number): string => String(value),
      },
    },
  });
}

function getSql(): Sql {
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
    return typeof value === "function" ? value.bind(getSql()) : value;
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
