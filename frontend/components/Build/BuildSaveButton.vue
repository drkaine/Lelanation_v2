<template>
  <div
    class="save-build-wrapper"
    :class="{ 'save-build-wrapper--streamer': isLayoutScaled }"
    @mouseenter="handleHover(true)"
    @mouseleave="handleHover(false)"
  >
    <button
      type="button"
      :disabled="!buildStore.isBuildValid || buildStore.status === 'loading'"
      :class="[
        'save-build-button rounded-lg px-4 py-2 font-semibold transition',
        buildStore.isBuildValid && buildStore.status !== 'loading'
          ? 'bg-accent text-background hover:bg-accent/90'
          : 'cursor-not-allowed bg-surface text-text/50',
      ]"
      @click="handleSave"
    >
      {{ buildStore.status === 'loading' ? 'Sauvegarde...' : 'Sauvegarder' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { guideToSaveWithBuild } from '~/utils/builderGuideStep'
import { buildsTabPath, tabAfterBuildChange } from '~/utils/buildsIndexTabs'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()
const guideStore = useMatchupGuideStore()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { isLayoutScaled } = useLayoutScaled()
const emit = defineEmits<{
  'highlight-missing': [value: boolean]
}>()

const handleHover = (isHovering: boolean) => {
  if (!isHovering) {
    emit('highlight-missing', false)
    return
  }
  if (buildStore.status === 'loading') {
    emit('highlight-missing', false)
    return
  }

  const firstIncompleteVariantIdx = buildStore.firstIncompleteSubBuildIndex
  if (buildStore.isMainBuildValid && firstIncompleteVariantIdx !== null) {
    buildStore.showSubBuild(firstIncompleteVariantIdx)
  }

  emit('highlight-missing', !buildStore.isBuildValid)
}

const handleSave = async () => {
  if (!buildStore.isBuildValid || buildStore.status === 'loading') {
    if (buildStore.status !== 'loading') {
      const firstIncompleteVariantIdx = buildStore.firstIncompleteSubBuildIndex
      if (buildStore.isMainBuildValid && firstIncompleteVariantIdx !== null) {
        buildStore.showSubBuild(firstIncompleteVariantIdx)
      }
    }
    emit('highlight-missing', true)
    return
  }
  emit('highlight-missing', false)
  const tab = tabAfterBuildChange(buildStore.currentBuild)
  // Un seul builder : le build va dans la bibliothèque, le guide en cours y est lié.
  if (buildStore.currentBuild?.matchupGuideEmbed)
    buildStore.currentBuild.matchupGuideEmbed = undefined
  const success = await buildStore.saveBuild()
  if (!success.ok) return
  if (!draftStore.hydrated) draftStore.hydrateFromStorage()
  const guide = buildStore.currentBuild
    ? guideToSaveWithBuild(buildStore.currentBuild, draftStore)
    : null
  if (guide) {
    if (!(await guideStore.saveGuide(guide))) return
    // Build d'équipe : le guide est stocké avec lui dans l'espace partagé.
    if (buildStore.currentBuild?.teamShared && !(await buildStore.syncSharedBuild(guide))) return
    draftStore.reset()
  }
  buildStore.createNewBuild()
  const query: Record<string, string> = {}
  if (route.query.app === 'on') query.app = 'on'
  router.push(localePath({ path: buildsTabPath(tab), query }))
}
</script>

<style scoped>
.save-build-wrapper {
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: center;
}

.save-build-button {
  width: 100%;
  max-width: 300px;
  min-height: 38px;
  line-height: 1;
}

.save-build-wrapper--streamer .save-build-button {
  max-width: 390px;
}
</style>
