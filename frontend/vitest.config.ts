import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

const frontendRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '~': frontendRoot,
    },
  },
  test: {
    environment: 'node',
  },
})
