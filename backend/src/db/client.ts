import postgres from "postgres";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }
  return url;
}

function parseBigIntToNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`BIGINT out of JS safe integer range: ${value}`);
  }
  return parsed;
}

export const sql = postgres(requireDatabaseUrl(), {
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

export async function healthCheck(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
