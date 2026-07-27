import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { YouTubeService } from '../../../src/services/YouTubeService.js'

const tempDirs: string[] = []

afterEach(async () => {
  tempDirs.length = 0
})

async function makeDirs(): Promise<{ backendDir: string; frontendDir: string; service: YouTubeService }> {
  const root = await mkdtemp(join(tmpdir(), 'youtube-service-'))
  tempDirs.push(root)
  const backendDir = join(root, 'backend')
  const frontendDir = join(root, 'frontend', 'public', 'data', 'youtube')
  await mkdir(backendDir, { recursive: true })
  await mkdir(frontendDir, { recursive: true })
  const service = new YouTubeService(backendDir, frontendDir)
  return { backendDir, frontendDir, service }
}

describe('YouTubeService.loadExistingChannelData', () => {
  it('reads cached channel data from frontend when backend file was deleted after copy', async () => {
    const { backendDir, frontendDir, service } = await makeDirs()
    const channelId = 'UC_test_channel'
    const payload = {
      channelId,
      channelName: 'Test',
      lastSync: '2026-07-27T12:00:00.000Z',
      videos: [{ id: 'abc123', title: 'Latest', publishedAt: '2026-07-27T10:00:00.000Z' }],
    }

    await writeFile(join(frontendDir, `${channelId}.json`), `${JSON.stringify(payload)}\n`, 'utf8')

    const loadExisting = (service as unknown as {
      loadExistingChannelData: (id: string) => Promise<{ isOk: () => boolean; unwrap: () => typeof payload | null }>
    }).loadExistingChannelData.bind(service)

    const result = await loadExisting(channelId)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()?.videos?.[0]?.id).toBe('abc123')

    const backendExists = await import('node:fs/promises').then(fs =>
      fs.access(join(backendDir, `${channelId}.json`)).then(() => true).catch(() => false),
    )
    expect(backendExists).toBe(false)
  })
})
