import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const tableName = process.argv[2];
  if (!databaseUrl) throw new Error("DATABASE_URL missing");
  if (!tableName) throw new Error("table name argument missing");

  const db = postgres(databaseUrl);
  try {
    const rows = await db<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = ${tableName}
      ORDER BY indexname
    `;
    for (const row of rows) {
      console.log(`${row.indexname} => ${row.indexdef}`);
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("list_indexes_failed", error);
  process.exitCode = 1;
});
