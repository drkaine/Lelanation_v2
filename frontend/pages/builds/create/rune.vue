<template>
  <BuildCreateRunePageView
    :is-streamer-mode="isStreamerMode"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :rune-selector-component="RuneSelector"
    :build-card-component="BuildCard"
    :build-save-button-component="BuildSaveButton"
    :build-menu-steps-component="BuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BuildCreateRunePageView } from '@lelanation/builds-ui'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import RuneSelector from '~/components/Build/RuneSelector.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import { useStreamerMode } from '~/composables/useStreamerMode'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Runes',
  meta: [
    {
      name: 'description',
      content: "Configurez les runes, shards et sorts d'invocateur pour votre build",
    },
  ],
})

const buildStore = useBuildStore()
const route = useRoute()
const { isStreamerMode } = useStreamerMode()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const highlightMissingFields = ref(false)

onMounted(() => {
  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  if (editId && buildStore.editSourceBuildId !== editId) {
    const loaded = buildStore.startEditingBuild(editId)
    if (!loaded) buildStore.ensureCurrentBuild()
  } else {
    buildStore.ensureCurrentBuild()
  }
  buildStore.setLastBuilderStep('rune')
})
</script>
