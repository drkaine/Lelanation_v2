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
import { useLayoutScaled } from '~/composables/useLayoutScaled'

const buildStore = useBuildStore()
const router = useRouter()
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
  const success = await buildStore.saveBuild()
  if (!success) return
  buildStore.createNewBuild()
  router.push(`${localePath('/builds')}?tab=my-builds`)
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
