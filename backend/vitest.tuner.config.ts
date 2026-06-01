import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/tuner/setup.ts'],
    include: ['tests/tuner/unit/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
