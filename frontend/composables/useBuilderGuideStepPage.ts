import { watch } from 'vue'
import { useMatchupGuideCreateBuilder } from '~/composables/useMatchupGuideCreateBuilder'
import {
  builderGuideQuery,
  builderGuideRedirectPath,
  readBuilderGuideQuery,
  type BuilderGuideSubstep,
} from '~/utils/builderGuideStep'

/** Page d'une sous-étape du guide : session + renvoi si la sous-étape est fermée. */
export function useBuilderGuideStepPage(step: BuilderGuideSubstep) {
  const builder = useMatchupGuideCreateBuilder(step)
  const { buildStore, draftStore, route, sessionReady } = builder
  const router = useRouter()
  const localePath = useLocalePath()

  watch(
    () => [sessionReady.value, buildStore.isBuildValid, draftStore.matchupEntries] as const,
    ([ready]) => {
      if (!ready || !route.path.endsWith(`/guide/${step}`)) return
      const target = builderGuideRedirectPath(step, {
        buildValid: buildStore.isBuildValid,
        hasChampion: Boolean(buildStore.currentBuild?.champion),
        matchupEntries: draftStore.matchupEntries,
      })
      if (!target) return
      const query = builderGuideQuery(readBuilderGuideQuery(route.query))
      router.replace(localePath({ path: target, query }))
    },
    { immediate: true, deep: true }
  )

  return builder
}
