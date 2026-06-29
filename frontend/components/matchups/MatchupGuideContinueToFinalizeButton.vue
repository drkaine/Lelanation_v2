<template>
  <div
    class="matchup-guide-continue-wrapper"
    :class="{ 'matchup-guide-continue-wrapper--streamer': isLayoutScaled }"
  >
    <button
      type="button"
      :disabled="!canContinue"
      :class="[
        'matchup-guide-continue-button rounded-lg px-4 py-2 font-semibold transition',
        canContinue
          ? 'bg-accent text-background hover:bg-accent/90'
          : 'cursor-not-allowed bg-surface text-text/50',
      ]"
      @click="handleContinue"
    >
      {{ t('matchupGuideCreate.continueToFinalize') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMatchupGuideDraftStore } from '~/stores/MatchupGuideDraftStore'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

const draftStore = useMatchupGuideDraftStore()
const route = useRoute()
const router = useRouter()
const localePath = useLocalePath()
const { t } = useI18n()
const { isLayoutScaled } = useLayoutScaled()

const canContinue = computed(() => draftStore.matchupEntries.length >= 2)

async function handleContinue() {
  if (!canContinue.value) return
  draftStore.setLastStep('finalize')
  const query: Record<string, string> = {}
  const editId = route.query.editId
  if (typeof editId === 'string' && editId.length > 0) query.editId = editId
  await router.push(localePath({ path: '/matchups/sheets/create/finalize', query }))
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
