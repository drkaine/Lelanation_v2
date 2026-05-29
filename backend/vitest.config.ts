import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/riot-gateway/unit/**/*.test.ts'],
    environment: 'node',
  },
});
