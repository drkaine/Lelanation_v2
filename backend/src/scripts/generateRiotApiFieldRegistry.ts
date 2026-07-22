/**
 * Génère backend/data/api-riot/field-registry.json à partir des fixtures match + timeline.
 * Usage: cd backend && npm run generate:riot-field-registry [-- --refresh-docs]
 */
import 'dotenv/config'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { buildFieldRegistryFromFixtures } from '../services/RiotApiFieldRegistryBuilder.js'

async function main(): Promise<void> {
  const refreshDocs = process.argv.includes('--refresh-docs')
  const { registry, diff } = await buildFieldRegistryFromFixtures({ refreshDocs })
  const outPath = join(process.cwd(), 'data', 'api-riot', 'field-registry.json')
  await writeFile(outPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8')
  console.log(`[registry] ${registry.rows.length} clés → ${outPath}`)
  if (diff.added.length || diff.removed.length) {
    console.log(`[registry] diff: +${diff.added.length} / -${diff.removed.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
