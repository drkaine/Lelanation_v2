import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { hydrateBuild } from '~/utils/buildSerialize'

export function startEditingMatchupGuide(guideId: string): boolean {
  if (import.meta.server) return false

  const guideStore = useMatchupGuideStore()
  const draftStore = useMatchupGuideDraftStore()
  const buildStore = useBuildStore()

  const guide = guideStore.getSavedGuides().find(g => g.id === guideId)
  if (!guide) return false

  draftStore.loadFromGuide(guide)

  if (guide.build) {
    const parsed = hydrateBuild(guide.build)
    buildStore.setCurrentBuild({
      ...parsed,
      author: guide.author ?? parsed.author,
      description: guide.description ?? parsed.description,
      visibility: guide.visibility ?? parsed.visibility ?? 'public',
      roles: guide.role ? [guide.role] : parsed.roles,
      tags: guide.tags ?? parsed.tags,
    })
  } else {
    buildStore.createNewBuild()
    const current = buildStore.currentBuild
    if (current) {
      current.author = guide.author
      current.description = guide.description
      current.visibility = guide.visibility ?? 'public'
      current.roles = guide.role ? [guide.role] : []
      current.tags = guide.tags
      if (guide.champion) {
        current.champion = {
          id: guide.champion.id,
          name: guide.champion.name,
          image: guide.champion.image,
        } as typeof current.champion
      }
      buildStore.persistCurrentBuildDraft()
    }
  }

  return true
}
