<template>
  <div
    class="matchup-guide-save-wrapper"
    :class="{ 'matchup-guide-save-wrapper--streamer': isLayoutScaled }"
  >
    <button
      type="button"
      :disabled="!canSave || saving"
      :class="[
        'matchup-guide-save-button rounded-lg px-4 py-2 font-semibold transition',
        canSave && !saving
          ? 'bg-accent text-background hover:bg-accent/90'
          : 'cursor-not-allowed bg-surface text-text/50',
      ]"
      @click="handleSave"
    >
      {{ saving ? t('matchupGuideCreate.saving') : t('matchupGuideCreate.saveGuide') }}
    </button>
    <p v-if="!canSave" class="matchup-guide-save-hint">
      {{ t('matchupGuideCreate.rankAtLeastTwo') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()
const guideStore = useMatchupGuideStore()
const router = useRouter()
const localePath = useLocalePath()
const { t } = useI18n()
const { isLayoutScaled } = useLayoutScaled()

const saving = ref(false)

const canSave = computed(
  () =>
    buildStore.isBuildValid &&
    draftStore.rankedOpponents.length >= 2 &&
    Boolean(buildStore.currentBuild?.champion)
)

async function handleSave() {
  if (!canSave.value || saving.value) return
  const guide = draftStore.buildGuideFromCurrentBuild(buildStore.currentBuild)
  if (!guide) return

  saving.value = true
  try {
    const ok = await guideStore.saveGuide(guide)
    if (!ok) return
    draftStore.reset()
    buildStore.createNewBuild()
    await router.push(localePath('/matchups/sheets/my-guides'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.matchup-guide-save-wrapper {
  margin-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.matchup-guide-save-button {
  width: 100%;
  max-width: 300px;
  min-height: 38px;
}

.matchup-guide-save-wrapper--streamer .matchup-guide-save-button {
  max-width: 390px;
}

.matchup-guide-save-hint {
  margin: 0;
  max-width: 300px;
  text-align: center;
  font-size: 0.75rem;
  color: rgb(var(--rgb-text) / 0.65);
}
</style>
