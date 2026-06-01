import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/tuner/setup.ts'],
    include: ['tests/tuner/e2e/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
