import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

function resolveStatistiquesDatabaseUrl(): string {
  const url = (
    process.env.DATABASE_URL_STATISTIQUES?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ''
  )
  if (!url) {
    throw new Error(
      'DATABASE_URL is required (postgresql://…:5434/lelanation_statistiques). See backend/.env.example',
    )
  }
  if (url.includes('lelanation_stats') && !url.includes('lelanation_statistiques')) {
    throw new Error(
      'DATABASE_URL still points to legacy lelanation_stats (port 5433). ' +
        'Set DATABASE_URL=postgresql://lelanation:lelanation@localhost:5434/lelanation_statistiques',
    )
  }
  return url
}

/** Migrations SQL + introspection pour la base `lelanation_statistiques` (Drizzle). */
export default defineConfig({
  schema: './src/drizzle/statistiquesSchema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: resolveStatistiquesDatabaseUrl(),
  },
})
