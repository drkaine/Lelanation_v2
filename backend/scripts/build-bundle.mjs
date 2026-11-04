/**
 * Production build: bundles the API (src/index.ts), the poller (src/main.ts) and the theorycraft
 * worker (src/scripts/buildTheorycraftData.ts) into dist/app/.
 * - npm dependencies stay external (resolved from node_modules at runtime);
 * - workspace packages (@lelanation/*) are bundled, since they ship TypeScript sources;
 * - dist/app/ sits two levels under backend/ like src/<dir>/, so `__dirname`-relative paths still resolve.
 */
import { build } from 'esbuild'
import { cp, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const outdir = join(backendRoot, 'dist', 'app')

const externalNpmPackages = {
  name: 'external-npm-packages',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, args =>
      args.path.startsWith('@lelanation/') ? undefined : { path: args.path, external: true }
    )
  },
}

await rm(outdir, { recursive: true, force: true })
await build({
  entryPoints: {
    index: join(backendRoot, 'src', 'index.ts'),
    main: join(backendRoot, 'src', 'main.ts'),
    // Child process of the Data Dragon sync (cron/dataDragonSyncRecovery.ts): >1 GB peak, own heap.
    buildTheorycraftData: join(backendRoot, 'src', 'scripts', 'buildTheorycraftData.ts'),
  },
  outdir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  // No code splitting: a shared chunk would be evaluated before `dotenv/config` in the entry.
  logLevel: 'warning',
  plugins: [externalNpmPackages],
})
// Read at runtime next to the module that loads it (src/redis/rate-scheduler.ts).
await cp(join(backendRoot, 'src', 'redis', 'lua'), join(outdir, 'lua'), { recursive: true })
console.log(`[build] bundle written to ${outdir}`)
