import type { Build, MatchupGuide, StoredBuild } from '@lelanation/shared-types'
import { serializeBuild } from '~/utils/buildSerialize'

export const BUILD_EDIT_SECRET_HEADER = 'x-build-edit-secret'

export function buildEditHeaders(editSecret?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = editSecret?.trim()
  if (secret) headers[BUILD_EDIT_SECRET_HEADER] = secret
  return headers
}

/** Serialize for API POST — never send editSecret in the JSON body. */
export function serializeBuildForApi(build: Build): StoredBuild {
  const stored = serializeBuild(build)
  const { editSecret: _omit, ...payload } = stored
  return payload
}

/** Body of POST /api/shared-builds: the team build, plus the guide linked to it (published with it). */
export function sharedBuildPayload(
  build: Build,
  guide?: MatchupGuide | null
): StoredBuild & { teamShared: true; matchupGuide?: MatchupGuide } {
  const payload = serializeBuildForApi({ ...build, teamShared: true, matchupGuideEmbed: undefined })
  return { ...payload, teamShared: true, ...(guide ? { matchupGuide: guide } : {}) }
}

export function applyEditSecretFromResponse(build: Build, result: { editSecret?: string }): Build {
  if (typeof result.editSecret === 'string' && result.editSecret.trim()) {
    return { ...build, editSecret: result.editSecret.trim() }
  }
  return build
}
