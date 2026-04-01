<template>
  <BuildCreateItemPageView
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :item-selector-component="ItemSelector"
    :build-card-component="BuildCard"
    :build-save-button-component="BuildSaveButton"
    :build-menu-steps-component="BuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BuildCreateItemPageView } from '@lelanation/builds-ui'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import ItemSelector from '~/components/Build/ItemSelector.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Items',
  meta: [
    {
      name: 'description',
      content: 'Sélectionnez les items pour votre build League of Legends',
    },
  ],
})

const buildStore = useBuildStore()
const route = useRoute()
const { isLayoutScaled } = useLayoutScaled()
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
  buildStore.setLastBuilderStep('item')
})
</script>
