import { describe, expect, it } from 'vitest'
import {
  sharedBuildHeaders,
  showLelarivaBadge,
  teamBuildActions,
  teamShareControls,
  teamVisibilityRequest,
  visibilityAfterTeamShare,
  visibilitySyncAction,
} from '../sharedBuildSync'

describe('visibilitySyncAction', () => {
  it('team_shared_build_always_goes_to_team_endpoint', () => {
    expect(visibilitySyncAction(null, { visibility: 'private', teamShared: true })).toBe(
      'saveShared'
    )
    expect(
      visibilitySyncAction({ visibility: 'public' }, { visibility: 'public', teamShared: true })
    ).toBe('saveShared')
  })

  it('public_is_saved_on_public_endpoint', () => {
    expect(visibilitySyncAction(null, { visibility: 'public' })).toBe('savePublic')
    expect(visibilitySyncAction({ visibility: 'private' }, { visibility: 'public' })).toBe(
      'savePublic'
    )
  })

  it('public_to_private_removes_server_copy', () => {
    expect(visibilitySyncAction({ visibility: 'public' }, { visibility: 'private' })).toBe(
      'deletePublic'
    )
  })

  it('private_stays_local', () => {
    expect(visibilitySyncAction(null, { visibility: 'private' })).toBe('none')
  })
})

describe('teamShareControls', () => {
  it('anonymous_cannot_share', () => {
    expect(teamShareControls({ role: null, teamShared: false, savedTeamShared: false })).toEqual({
      showTeamShare: false,
      teamShareLocked: false,
      visibilityLocked: false,
    })
  })

  it('lelateam_sharing_locks_visibility', () => {
    expect(
      teamShareControls({ role: 'lelateam', teamShared: true, savedTeamShared: false })
    ).toEqual({
      showTeamShare: true,
      teamShareLocked: false,
      visibilityLocked: true,
    })
  })

  it('lelariva_and_admin_keep_visibility_choice', () => {
    for (const role of ['lelariva', 'admin'] as const) {
      expect(
        teamShareControls({ role, teamShared: true, savedTeamShared: false }).visibilityLocked
      ).toBe(false)
    }
  })

  it('saved_team_build_cannot_be_unshared', () => {
    expect(
      teamShareControls({ role: 'lelariva', teamShared: true, savedTeamShared: true })
        .teamShareLocked
    ).toBe(true)
  })
})

describe('visibilityAfterTeamShare', () => {
  it('lelateam_sharing_forces_private', () => {
    expect(visibilityAfterTeamShare('public', 'lelateam')).toBe('private')
  })

  it('managers_keep_their_visibility', () => {
    expect(visibilityAfterTeamShare('public', 'lelariva')).toBe('public')
    expect(visibilityAfterTeamShare('public', 'admin')).toBe('public')
  })
})

describe('sharedBuildHeaders', () => {
  it('adds_bearer_and_edit_secret', () => {
    expect(sharedBuildHeaders('tok', ' sec ')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok',
      'x-build-edit-secret': 'sec',
    })
  })

  it('omits_edit_secret_when_absent', () => {
    expect(sharedBuildHeaders('tok')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok',
    })
  })
})

describe('teamBuildActions', () => {
  it('only_managers_change_visibility_or_delete', () => {
    expect(teamBuildActions('lelateam')).toMatchObject({
      canChangeVisibility: false,
      canDelete: false,
    })
    expect(teamBuildActions(null)).toMatchObject({ canChangeVisibility: false, canDelete: false })
    expect(teamBuildActions('lelariva')).toMatchObject({
      canChangeVisibility: true,
      canDelete: true,
    })
  })

  it('every_team_member_can_edit', () => {
    expect(teamBuildActions('lelateam').canEdit).toBe(true)
    expect(teamBuildActions('lelariva').canEdit).toBe(true)
    expect(teamBuildActions('admin').canEdit).toBe(true)
    expect(teamBuildActions(null).canEdit).toBe(false)
  })
})

describe('teamVisibilityRequest', () => {
  it('toggles_between_publish_and_unpublish', () => {
    expect(teamVisibilityRequest('private')).toBe('publish')
    expect(teamVisibilityRequest(undefined)).toBe('publish')
    expect(teamVisibilityRequest('public')).toBe('unpublish')
  })
})

describe('showLelarivaBadge', () => {
  it('only_published_team_builds_get_the_badge', () => {
    expect(showLelarivaBadge({ lelarivaBadge: true })).toBe(true)
    expect(showLelarivaBadge({})).toBe(false)
    expect(showLelarivaBadge(null)).toBe(false)
  })

  it('team_builds_show_the_badge_even_private', () => {
    expect(showLelarivaBadge({ teamShared: true })).toBe(true)
    expect(showLelarivaBadge({ teamShared: false })).toBe(false)
  })
})
