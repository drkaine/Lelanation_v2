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
      {{ saveHint }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { useMatchupGuideStore } from '~/stores/MatchupGuideStore'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import {
  areAllMatchupsFinalizeReady,
  buildMatchupGuideStepAccessContext,
  canSaveMatchupGuide,
  getMissingFinalizeIdentityFields,
  MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE,
} from '~/utils/matchupGuideCreateSteps'

const buildStore = useBuildStore()
const draftStore = useMatchupGuideDraftStore()
const guideStore = useMatchupGuideStore()
const router = useRouter()
const localePath = useLocalePath()
const { t } = useI18n()
const { isLayoutScaled } = useLayoutScaled()

const saving = ref(false)

const stepContext = computed(() =>
  buildMatchupGuideStepAccessContext({
    buildValid: buildStore.isBuildValid,
    hasChampion: Boolean(buildStore.currentBuild?.champion),
    matchupEntries: draftStore.matchupEntries,
  })
)

const identityFields = computed(() => ({
  guideName: buildStore.currentBuild?.name,
  author: buildStore.currentBuild?.author,
  shortDescription: draftStore.meta.shortDescription,
}))

const missingIdentityFields = computed(() => getMissingFinalizeIdentityFields(identityFields.value))

const canSave = computed(() =>
  canSaveMatchupGuide({
    ...stepContext.value,
    ...identityFields.value,
  })
)

const saveHint = computed(() => {
  if (!buildStore.isBuildValid) return t('matchupGuideCreate.completeBuildHint')
  if (draftStore.matchupEntries.length < MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE) {
    return t('matchupGuideCreate.rankAtLeastTen')
  }
  if (!areAllMatchupsFinalizeReady(draftStore.matchupEntries)) {
    return t('matchupGuideCreate.finalizeUnlockHint')
  }
  if (missingIdentityFields.value.length > 0) {
    return t('matchupGuideCreate.finalizeMissingIdentity')
  }
  return t('matchupGuideCreate.rankAtLeastTen')
})

async function handleSave() {
  if (!canSave.value || saving.value) return

  saving.value = true
  try {
    if (!buildStore.isBuildValid) return

    const buildId = buildStore.currentBuild?.id
    if (buildId) {
      await buildStore.detachBuildFromLibrary(buildId)
    }

    const guide = draftStore.buildGuideFromCurrentBuild(buildStore.currentBuild)
    if (!guide) return

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
  max-width: 420px;
  text-align: center;
  font-size: 0.75rem;
  color: rgb(var(--rgb-text) / 0.65);
}
</style>
