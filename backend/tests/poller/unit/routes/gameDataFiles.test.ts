import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readVersionedGameData } from '../../../../src/routes/gameDataFiles.js'

function dataDirs() {
  const root = mkdtempSync(join(tmpdir(), 'game-data-'))
  const dirs = { backendDir: join(root, 'back'), frontendDir: join(root, 'front') }
  const put = (dir: string, file: string, data: unknown) => {
    mkdirSync(join(dir, '16.18.1', 'fr_FR'), { recursive: true })
    writeFileSync(join(dir, '16.18.1', 'fr_FR', file), JSON.stringify(data))
  }
  return { dirs, put }
}

describe('readVersionedGameData', () => {
  it('prefers the backend copy, falls back to the frontend copy', async () => {
    const { dirs, put } = dataDirs()
    put(dirs.frontendDir, 'item.json', { from: 'front' })
    expect((await readVersionedGameData(dirs, '16.18.1', 'fr_FR', ['item.json'])).unwrap()).toEqual({ from: 'front' })
    put(dirs.backendDir, 'item.json', { from: 'back' })
    expect((await readVersionedGameData(dirs, '16.18.1', 'fr_FR', ['item.json'])).unwrap()).toEqual({ from: 'back' })
  })

  it('returns the read error when no file exists', async () => {
    const { dirs } = dataDirs()
    const result = await readVersionedGameData(dirs, '16.18.1', 'fr_FR', ['summoner.json'])
    expect(result.isErr()).toBe(true)
  })
})
