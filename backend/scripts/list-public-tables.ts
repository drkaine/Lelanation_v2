import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL missing");
  }

  const db = postgres(databaseUrl);
  try {
    const rows = await db<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    for (const row of rows) {
      console.log(row.tablename);
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("list_tables_failed", error);
  process.exitCode = 1;
});
