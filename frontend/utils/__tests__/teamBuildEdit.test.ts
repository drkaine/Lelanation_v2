import { describe, expect, it, vi } from 'vitest'
import { fetchTeamBuildForEdit } from '../teamBuildEdit'

const ok = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) }) as Response

describe('fetchTeamBuildForEdit', () => {
  it('returns_the_server_team_build_marked_shared', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok({ id: 'abc', name: 'Kayn' }))
    const build = await fetchTeamBuildForEdit('abc', fetcher)
    expect(fetcher).toHaveBeenCalledWith('/api/shared-builds/abc')
    expect(build).toMatchObject({ id: 'abc', name: 'Kayn', teamShared: true })
  })

  it('returns_null_when_not_a_team_build', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false } as Response)
    expect(await fetchTeamBuildForEdit('abc', fetcher)).toBeNull()
  })

  it('returns_null_on_network_error_or_mismatched_id', async () => {
    expect(await fetchTeamBuildForEdit('abc', vi.fn().mockRejectedValue(new Error('x')))).toBeNull()
    expect(
      await fetchTeamBuildForEdit('abc', vi.fn().mockResolvedValue(ok({ id: 'zzz' })))
    ).toBeNull()
  })
})
