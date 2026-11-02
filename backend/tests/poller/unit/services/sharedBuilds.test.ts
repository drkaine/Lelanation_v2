import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  deleteSharedBuild,
  getSharedBuild,
  listSharedBuilds,
  publishSharedBuild,
  saveSharedBuild,
  unpublishSharedBuild,
} from '../../../../src/services/SharedBuildService.js'

const ID = '11111111-2222-4333-8444-555555555555'
const RIVA = { id: 1, username: 'Riva', role: 'lelariva' as const }
const TEAM = { id: 2, username: 'Team', role: 'lelateam' as const }

function dirs() {
  const root = mkdtempSync(join(tmpdir(), 'shared-builds-'))
  const d = { sharedDir: join(root, 'shared'), buildsDir: join(root, 'builds') }
  mkdirSync(d.buildsDir, { recursive: true })
  return d
}

describe('SharedBuildService', () => {
  it('creates then updates a shared build, tracking who created and who edited', async () => {
    const d = dirs()
    const created = await saveSharedBuild(d, { id: ID, name: 'Ahri mid', visibility: 'shared' }, TEAM)
    expect(created).toMatchObject({ ok: true, id: ID })
    const updated = await saveSharedBuild(d, { id: ID, name: 'Ahri mid v2', editSecret: 'x' }, RIVA)
    expect(updated.ok).toBe(true)

    const build = await getSharedBuild(d, ID)
    expect(build).toMatchObject({ id: ID, name: 'Ahri mid v2', visibility: 'private', teamShared: true })
    expect(build?.sharedMeta).toMatchObject({ createdBy: 'Team', updatedBy: 'Riva' })
    expect(build).not.toHaveProperty('editSecret')
  })

  it('generates an id when none is given and rejects a bad id', async () => {
    const d = dirs()
    const res = await saveSharedBuild(d, { name: 'x' }, TEAM)
    expect(res.ok).toBe(true)
    expect(await saveSharedBuild(d, { id: '../evil', name: 'x' }, TEAM)).toEqual({ ok: false, error: 'INVALID_ID' })
  })

  it('lists shared builds, most recently updated first', async () => {
    const d = dirs()
    const other = '99999999-2222-4333-8444-555555555555'
    await saveSharedBuild(d, { id: ID, name: 'first' }, TEAM, new Date('2026-01-01'))
    await saveSharedBuild(d, { id: other, name: 'second' }, TEAM, new Date('2026-02-01'))
    expect((await listSharedBuilds(d)).map(b => b.name)).toEqual(['second', 'first'])
  })

  it('moves an own public build into the shared space when the edit secret matches', async () => {
    const d = dirs()
    const publicFile = join(d.buildsDir, `${ID}.json`)
    writeFileSync(publicFile, JSON.stringify({ id: ID, name: 'mine', editSecret: 'good' }))

    expect(await saveSharedBuild(d, { id: ID, name: 'mine' }, TEAM, new Date(), 'bad')).toEqual({
      ok: false,
      error: 'FORBIDDEN',
    })
    expect(existsSync(publicFile)).toBe(true)

    expect((await saveSharedBuild(d, { id: ID, name: 'mine' }, TEAM, new Date(), 'good')).ok).toBe(true)
    expect(existsSync(publicFile)).toBe(false)
    expect(await getSharedBuild(d, ID)).toMatchObject({ name: 'mine' })
  })

  it('publish keeps the team copy and writes the public file with an edit secret', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'Ahri' }, TEAM)
    const res = await publishSharedBuild(d, ID)
    expect(res?.id).toBe(ID)
    expect(res?.editSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(await getSharedBuild(d, ID)).toMatchObject({ visibility: 'public', teamShared: true })

    const published = JSON.parse(readFileSync(join(d.buildsDir, `${ID}.json`), 'utf8'))
    expect(published).toMatchObject({ id: ID, name: 'Ahri', visibility: 'public', editSecret: res?.editSecret })
    expect(published).not.toHaveProperty('sharedMeta')

    const again = await publishSharedBuild(d, ID)
    expect(again?.editSecret).toBe(res?.editSecret)
  })

  it('lelateam cannot make a shared build public: it stays private', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public' }, TEAM)
    expect(await getSharedBuild(d, ID)).toMatchObject({ visibility: 'private' })
    expect(existsSync(join(d.buildsDir, `${ID}.json`))).toBe(false)
  })

  it('lelariva saving as public publishes and keeps the team copy', async () => {
    const d = dirs()
    const res = await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public' }, RIVA)
    expect(res).toMatchObject({ ok: true, id: ID })
    expect(res.ok && res.editSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(await getSharedBuild(d, ID)).toMatchObject({ visibility: 'public', teamShared: true })
    expect(JSON.parse(readFileSync(join(d.buildsDir, `${ID}.json`), 'utf8'))).toMatchObject({
      name: 'x',
      visibility: 'public',
    })
  })

  it('lelateam editing a published team build keeps it public and updates the public file', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'v1', visibility: 'public' }, RIVA)
    const res = await saveSharedBuild(d, { id: ID, name: 'v2', visibility: 'private' }, TEAM)
    expect(res.ok).toBe(true)
    expect(await getSharedBuild(d, ID)).toMatchObject({ name: 'v2', visibility: 'public' })
    expect(JSON.parse(readFileSync(join(d.buildsDir, `${ID}.json`), 'utf8'))).toMatchObject({ name: 'v2' })
  })

  it('lelariva can set a published team build back to private', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'v1', visibility: 'public' }, RIVA)
    await saveSharedBuild(d, { id: ID, name: 'v1', visibility: 'private' }, RIVA)
    expect(await getSharedBuild(d, ID)).toMatchObject({ visibility: 'private' })
    expect(existsSync(join(d.buildsDir, `${ID}.json`))).toBe(false)
  })

  it('delete removes the team copy and its public file; unknown ids return false / null', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public' }, RIVA)
    expect(await deleteSharedBuild(d, ID)).toBe(true)
    expect(existsSync(join(d.buildsDir, `${ID}.json`))).toBe(false)
    expect(await deleteSharedBuild(d, ID)).toBe(false)
    expect(await publishSharedBuild(d, ID)).toBeNull()
  })

  it('the public copy of a team build carries the lelariva badge', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public' }, RIVA)
    const pub = JSON.parse(readFileSync(join(d.buildsDir, `${ID}.json`), 'utf8'))
    expect(pub).toMatchObject({ lelarivaBadge: true, visibility: 'public' })
    expect(pub).not.toHaveProperty('teamShared')
  })

  it('unpublish sets the team build private and removes the public file', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public' }, RIVA)
    expect(await unpublishSharedBuild(d, ID)).toBe(true)
    expect(await getSharedBuild(d, ID)).toMatchObject({ visibility: 'private', teamShared: true })
    expect(existsSync(join(d.buildsDir, `${ID}.json`))).toBe(false)
    expect(await unpublishSharedBuild(d, '99999999-2222-4333-8444-555555555555')).toBe(false)
  })
})
