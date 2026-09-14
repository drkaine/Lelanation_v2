import type { Build, StoredBuild } from '@lelanation/shared-types'

export type PaginatedBuildsResponse = {
  items: (Build | StoredBuild)[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export function isPaginatedBuildsResponse(payload: unknown): payload is PaginatedBuildsResponse {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as PaginatedBuildsResponse
  return Array.isArray(p.items) && typeof p.hasMore === 'boolean'
}

const DEFAULT_PAGE_SIZE = 80

/** Charge le catalogue public par pages (1ère page bloquante, reste en arrière-plan). */
export async function fetchPublicBuildsProgressive(
  fetchJson: (path: string) => Promise<unknown>,
  options?: {
    pageSize?: number
    onFirstPage?: (builds: (Build | StoredBuild)[]) => void
    onComplete?: (builds: (Build | StoredBuild)[]) => void
  }
): Promise<(Build | StoredBuild)[]> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const firstPayload = await fetchJson(`/api/builds?page=1&limit=${pageSize}`)
  if (Array.isArray(firstPayload)) {
    options?.onFirstPage?.(firstPayload)
    options?.onComplete?.(firstPayload)
    return firstPayload
  }
  if (!isPaginatedBuildsResponse(firstPayload)) {
    return []
  }

  let allBuilds = [...firstPayload.items]
  options?.onFirstPage?.(allBuilds)

  if (!firstPayload.hasMore) {
    options?.onComplete?.(allBuilds)
    return allBuilds
  }

  ;(async () => {
    let page = 2
    while (true) {
      const payload = await fetchJson(`/api/builds?page=${page}&limit=${pageSize}`)
      if (!isPaginatedBuildsResponse(payload)) break
      allBuilds = allBuilds.concat(payload.items)
      options?.onComplete?.(allBuilds)
      if (!payload.hasMore) break
      page += 1
    }
  })().catch(() => undefined)

  return allBuilds
}
