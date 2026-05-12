import postgres from "postgres";
import { config } from "../config/index.js";

function parseBigIntToNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`BIGINT out of JS safe integer range: ${value}`);
  }
  return parsed;
}

export const sql = postgres(config.DATABASE_URL, {
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
