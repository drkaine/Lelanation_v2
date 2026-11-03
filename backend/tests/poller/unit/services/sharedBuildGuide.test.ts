import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  deleteSharedBuild,
  getSharedBuild,
  publishSharedBuild,
  saveSharedBuild,
  unpublishSharedBuild,
} from '../../../../src/services/SharedBuildService.js'

const ID = '11111111-2222-4333-8444-555555555555'
const GUIDE_ID = 'aaaaaaaa-2222-4333-8444-555555555555'
const RIVA = { id: 1, username: 'Riva', role: 'lelariva' as const }
const TEAM = { id: 2, username: 'Team', role: 'lelateam' as const }

function dirs() {
  const root = mkdtempSync(join(tmpdir(), 'shared-guide-'))
  const d = {
    sharedDir: join(root, 'shared'),
    buildsDir: join(root, 'builds'),
    guidesDir: join(root, 'guides'),
  }
  mkdirSync(d.buildsDir, { recursive: true })
  return d
}

const guide = {
  id: GUIDE_ID,
  buildId: ID,
  visibility: 'private',
  matchups: [{ opponent: { id: 'Zed' } }],
  build: { id: ID, name: 'snapshot' },
}
const guideFile = (d: ReturnType<typeof dirs>) => join(d.guidesDir, `${GUIDE_ID}.json`)

describe('SharedBuildService — guide lié', () => {
  it('garde le guide dans la copie d’équipe, sans le publier tant que le build est privé', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'Kayn', matchupGuide: guide }, TEAM)
    expect(await getSharedBuild(d, ID)).toMatchObject({ matchupGuide: { id: GUIDE_ID } })
    expect(existsSync(guideFile(d))).toBe(false)
  })

  it('ignore un guide invalide (id dangereux ou pas un objet)', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', matchupGuide: { ...guide, id: '../evil' } }, TEAM)
    expect(await getSharedBuild(d, ID)).not.toHaveProperty('matchupGuide')
    await saveSharedBuild(d, { id: ID, name: 'x', matchupGuide: 'nope' }, TEAM)
    expect(await getSharedBuild(d, ID)).not.toHaveProperty('matchupGuide')
  })

  it('publier écrit le guide public lié au build ; la copie publique du build ne le contient pas', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'Kayn', matchupGuide: guide }, TEAM)
    await publishSharedBuild(d, ID)
    const pub = JSON.parse(readFileSync(guideFile(d), 'utf8'))
    expect(pub).toMatchObject({ id: GUIDE_ID, buildId: ID, visibility: 'public' })
    expect(pub).not.toHaveProperty('build')
    expect(JSON.parse(readFileSync(join(d.buildsDir, `${ID}.json`), 'utf8'))).not.toHaveProperty(
      'matchupGuide'
    )
  })

  it('lelariva qui enregistre en public publie aussi le guide', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public', matchupGuide: guide }, RIVA)
    expect(existsSync(guideFile(d))).toBe(true)
  })

  it('dépublier ou supprimer retire le guide public', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public', matchupGuide: guide }, RIVA)
    await unpublishSharedBuild(d, ID)
    expect(existsSync(guideFile(d))).toBe(false)

    await publishSharedBuild(d, ID)
    expect(existsSync(guideFile(d))).toBe(true)
    await deleteSharedBuild(d, ID)
    expect(existsSync(guideFile(d))).toBe(false)
  })

  it('repasser en privé via l’enregistrement retire le guide public', async () => {
    const d = dirs()
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'public', matchupGuide: guide }, RIVA)
    await saveSharedBuild(d, { id: ID, name: 'x', visibility: 'private', matchupGuide: guide }, RIVA)
    expect(existsSync(guideFile(d))).toBe(false)
  })
})
