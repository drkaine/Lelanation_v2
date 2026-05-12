import postgres from "postgres";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const tableName = process.argv[2];
  if (!databaseUrl) throw new Error("DATABASE_URL missing");
  if (!tableName) throw new Error("table name argument missing");

  const db = postgres(databaseUrl);
  try {
    const rows = await db<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ORDER BY ordinal_position
    `;
    for (const row of rows) {
      console.log(`${row.column_name} (${row.data_type})`);
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("list_columns_failed", error);
  process.exitCode = 1;
});
