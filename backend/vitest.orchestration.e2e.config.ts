import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['tests/poll-orchestration/setup.ts'],
    include: ['tests/poll-orchestration/e2e/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
