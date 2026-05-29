import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/poller/stability/**/*.test.ts'],
    environment: 'node',
    testTimeout: 3_600_000,
    fileParallelism: false,
    maxWorkers: 1,
  },
});
