import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isGameDataNotFound, readVersionedGameData } from '../../../../src/routes/gameDataFiles.js'

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

  it('tries the next file when the previous one is missing', async () => {
    const { dirs, put } = dataDirs()
    put(dirs.backendDir, 'championFull.json', { full: true })
    const result = await readVersionedGameData(dirs, '16.18.1', 'fr_FR', ['champion.json', 'championFull.json'])
    expect(result.unwrap()).toEqual({ full: true })
  })

  it('reports a missing file as not found', async () => {
    const { dirs } = dataDirs()
    const result = await readVersionedGameData(dirs, '16.18.1', 'fr_FR', ['summoner.json'])
    expect(isGameDataNotFound(result.unwrapErr())).toBe(true)
  })

  it('does not report an unreadable file as not found', async () => {
    const { dirs } = dataDirs()
    mkdirSync(join(dirs.backendDir, '16.18.1', 'fr_FR'), { recursive: true })
    writeFileSync(join(dirs.backendDir, '16.18.1', 'fr_FR', 'item.json'), '{broken')
    mkdirSync(join(dirs.frontendDir, '16.18.1', 'fr_FR'), { recursive: true })
    writeFileSync(join(dirs.frontendDir, '16.18.1', 'fr_FR', 'item.json'), '{broken')
    const result = await readVersionedGameData(dirs, '16.18.1', 'fr_FR', ['item.json'])
    expect(isGameDataNotFound(result.unwrapErr())).toBe(false)
  })
})
