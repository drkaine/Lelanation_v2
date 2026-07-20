import { defineConfig } from 'vitest/config';

/**
 * Tests d'intégration de l'agrégation contre une base PostgreSQL de TEST ISOLÉE
 * (jamais la prod). La base `lelanation_stats_test` doit exister avec le schéma
 * des agrégats (cloné depuis la prod via `pg_dump --schema-only`).
 *
 * Redis / BullMQ sont mockés dans les tests pour éviter tout contact avec la prod.
 */
export default defineConfig({
  test: {
    include: ['tests/aggregation/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://lelanation:lelanation@localhost:5434/lelanation_stats_test',
      // Redis/BullMQ sont mockés ; ces valeurs satisfont seulement la validation
      // du module `config` au chargement (aucune connexion réelle n'est ouverte).
      ENV: 'dev',
      REDIS_URL: 'redis://localhost:6379',
      RIOT_API_KEY: 'test-key',
    },
  },
});
