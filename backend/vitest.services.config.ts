import { defineConfig } from 'vitest/config';

/** Tests unitaires de services (DB/Redis mockés, aucune connexion réelle). */
export default defineConfig({
  test: {
    include: ['tests/services/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
  },
});
