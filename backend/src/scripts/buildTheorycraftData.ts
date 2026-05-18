import { join } from 'path'
import { FileManager } from '../utils/fileManager.js'
import { TheorycraftDataBuilderService } from '../services/TheorycraftDataBuilderService.js'

async function main(): Promise<void> {
  const versionPath = join(process.cwd(), 'data', 'game', 'version.json')
  const versionRes = await FileManager.readJson<{ currentVersion?: string }>(versionPath)
  if (versionRes.isErr()) {
    throw new Error(`Unable to read version file: ${versionRes.unwrapErr().message}`)
  }
  const currentVersion = String(versionRes.unwrap().currentVersion ?? '').trim()
  if (!currentVersion) {
    throw new Error('No currentVersion in data/game/version.json')
  }

  const builder = new TheorycraftDataBuilderService()
  const buildRes = await builder.build(currentVersion)
  if (buildRes.isErr()) {
    const message = buildRes.unwrapErr().message
    throw new Error(
      `Theorycraft build failed: ${message}\n` +
        'Tip: run "npm run sync:data" to sync all game data, or ensure network access to Data Dragon.'
    )
  }
  const out = buildRes.unwrap()
  console.log(
    `[build-theorycraft-data] ok version=${currentVersion} champions=${out.champions}`
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
