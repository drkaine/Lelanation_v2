<template>
  <div>
    <BuildCreateChampionPageView
      full-width
      :is-streamer-mode="isLayoutScaled"
      :has-champion="hasChampion"
      :highlight-missing-fields="highlightMissingFields"
      :pending-champion-change="Boolean(buildStore.pendingChampionChange)"
      :confirm-title="t('matchupGuideCreate.changeChampionTitle')"
      :confirm-body="t('matchupGuideCreate.changeChampionBody')"
      :cancel-label="t('matchupGuideCreate.cancel')"
      :confirm-label="t('matchupGuideCreate.confirm')"
      :champion-selector-component="ChampionSelector"
      :build-card-component="BuildCard"
      :build-save-button-component="MatchupGuideBuildCardSpacer"
      :build-menu-steps-component="MatchupGuideBuildMenuSteps"
      @highlight-missing="highlightMissingFields = $event"
      @cancel-champion-change="buildStore.cancelChampionChange()"
      @confirm-champion-change="buildStore.confirmChampionChange()"
    >
      <template #selector-extra>
        <div class="matchup-guide-import-build">
          <button
            type="button"
            class="matchup-guide-import-build__button"
            @click="buildPickerOpen = true"
          >
            {{ t('matchupGuideCreate.importFromBuild') }}
          </button>
        </div>
      </template>
    </BuildCreateChampionPageView>

    <MatchupGuideBuildPickerModal v-model:open="buildPickerOpen" @select="importBuild" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BuildCreateChampionPageView } from '@lelanation/builds-ui'
import BuildCard from '~/components/Build/BuildCard.vue'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import MatchupGuideBuildMenuSteps from '~/components/matchups/MatchupGuideBuildMenuSteps.vue'
import MatchupGuideBuildCardSpacer from '~/components/matchups/MatchupGuideBuildCardSpacer.vue'
import MatchupGuideBuildPickerModal from '~/components/matchups/MatchupGuideBuildPickerModal.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'
import { useMatchupGuideCreateBuilder } from '~/composables/useMatchupGuideCreateBuilder'

definePageMeta({
  layout: false,
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { buildStore } = useMatchupGuideCreateBuilder('champion')
const { isLayoutScaled } = useLayoutScaled()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const highlightMissingFields = ref(false)
const buildPickerOpen = ref(false)

watch(hasChampion, value => {
  if (value && route.path.includes('/matchups/sheets/create/champion')) {
    const query: Record<string, string> = {}
    const editId = route.query.editId
    if (typeof editId === 'string' && editId.length > 0) query.editId = editId
    router.push(localePath({ path: '/matchups/sheets/create/rune', query }))
  }
})

async function importBuild(buildId: string) {
  await router.push(
    localePath({
      path: '/matchups/sheets/create',
      query: { fromBuildId: buildId },
    })
  )
}

useHead({
  title: () => t('matchupGuideCreate.titleChampion'),
})
</script>

<style scoped>
.matchup-guide-import-build {
  margin-bottom: 0.75rem;
}

.matchup-guide-import-build__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgb(var(--rgb-accent) / 0.65);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-accent) / 0.12);
  padding: 0.5rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: rgb(var(--rgb-accent-light) / 1);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.matchup-guide-import-build__button:hover {
  border-color: rgb(var(--rgb-accent) / 1);
  background: rgb(var(--rgb-accent) / 0.28);
  color: rgb(var(--rgb-text) / 1);
}
</style>
