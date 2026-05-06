<template>
  <BuildCreateChampionPageView
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :pending-champion-change="Boolean(buildStore.pendingChampionChange)"
    :confirm-title="'Changer de champion ?'"
    :confirm-body="'Vous allez perdre toutes les variantes de ce build. Cette action est irréversible.'"
    :cancel-label="'Annuler'"
    :confirm-label="'Confirmer'"
    :champion-selector-component="ChampionSelector"
    :build-card-component="BuildCard"
    :build-save-button-component="BuildSaveButton"
    :build-menu-steps-component="BuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
    @cancel-champion-change="buildStore.cancelChampionChange()"
    @confirm-champion-change="buildStore.confirmChampionChange()"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BuildCreateChampionPageView } from '@lelanation/builds-ui'
import { useBuildStore } from '~/stores/BuildStore'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Champion',
  meta: [
    {
      name: 'description',
      content: 'Sélectionnez un champion pour créer votre build League of Legends',
    },
  ],
})

const buildStore = useBuildStore()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { isLayoutScaled } = useLayoutScaled()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const highlightMissingFields = ref(false)

watch(hasChampion, newValue => {
  if (newValue && route.path.includes('/builds/create/champion')) {
    const query: Record<string, string> = {}
    const id = buildStore.editSourceBuildId
    if (id) query.editId = id
    if (route.query.app === 'on') query.app = 'on'
    router.push(localePath({ path: '/builds/create/rune', query }))
  }
})

onMounted(() => {
  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  if (editId && buildStore.editSourceBuildId !== editId) {
    const loaded = buildStore.startEditingBuild(editId)
    if (!loaded) buildStore.ensureCurrentBuild()
  } else {
    buildStore.ensureCurrentBuild()
  }
  buildStore.setLastBuilderStep('champion')
})
</script>
