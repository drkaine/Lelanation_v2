<template>
  <div
    class="matchup-guide-continue-wrapper"
    :class="{ 'matchup-guide-continue-wrapper--streamer': isLayoutScaled }"
    @mouseenter="handleHover(true)"
    @mouseleave="handleHover(false)"
  >
    <button
      type="button"
      :disabled="buildStore.status === 'loading'"
      :class="[
        'matchup-guide-continue-button rounded-lg px-4 py-2 font-semibold transition',
        buildStore.status !== 'loading'
          ? 'bg-accent text-background hover:bg-accent/90'
          : 'cursor-not-allowed bg-surface text-text/50',
      ]"
      @click="handleContinue"
    >
      {{
        buildStore.status === 'loading'
          ? t('matchupGuideCreate.saving')
          : t('matchupGuideCreate.continueToMatchups')
      }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useBuildStore } from '~/stores/BuildStore'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

const buildStore = useBuildStore()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { t } = useI18n()
const { isLayoutScaled } = useLayoutScaled()

const emit = defineEmits<{
  'highlight-missing': [value: boolean]
}>()

function handleHover(isHovering: boolean) {
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

async function handleContinue() {
  if (!buildStore.isBuildValid || buildStore.status === 'loading') {
    const firstIncompleteVariantIdx = buildStore.firstIncompleteSubBuildIndex
    if (buildStore.isMainBuildValid && firstIncompleteVariantIdx !== null) {
      buildStore.showSubBuild(firstIncompleteVariantIdx)
    }
    emit('highlight-missing', true)
    return
  }
  emit('highlight-missing', false)
  const query: Record<string, string> = {}
  const editId = route.query.editId
  if (typeof editId === 'string' && editId.length > 0) query.editId = editId
  await router.push(localePath({ path: '/matchups/sheets/create/matchups', query }))
}
</script>

<style scoped>
.matchup-guide-continue-wrapper {
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: center;
}

.matchup-guide-continue-button {
  width: 100%;
  max-width: 300px;
  min-height: 38px;
}

.matchup-guide-continue-wrapper--streamer .matchup-guide-continue-button {
  max-width: 390px;
}
</style>
