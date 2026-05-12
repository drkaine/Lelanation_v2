import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

/** Migrations SQL + introspection pour la base `lelanation_statistiques` (Drizzle). */
export default defineConfig({
  schema: './src/drizzle/statistiquesSchema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_STATISTIQUES ?? '',
  },
})
