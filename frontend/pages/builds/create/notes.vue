<template>
  <BuildCreateNotesPageView
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :build-card-component="BuildCard"
    :build-save-button-component="BuildSaveButton"
    :build-notes-editor-component="BuildNotesEditor"
    :build-menu-steps-component="BuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { BuildCreateNotesPageView } from '@lelanation/builds-ui'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import BuildNotesEditor from '~/components/Build/BuildNotesEditor.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Notes',
  meta: [
    {
      name: 'description',
      content: 'Ajoutez des notes, conseils et vidéos à votre build',
    },
  ],
})

const buildStore = useBuildStore()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const { isLayoutScaled } = useLayoutScaled()
const highlightMissingFields = ref(false)

onMounted(() => {
  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  if (editId && buildStore.editSourceBuildId !== editId) {
    const loaded = buildStore.startEditingBuild(editId)
    if (!loaded) buildStore.ensureCurrentBuild()
  } else {
    buildStore.ensureCurrentBuild()
  }
  buildStore.setLastBuilderStep('notes')
})

watch(
  () => buildStore.currentBuild?.champion,
  champion => {
    if (!champion && route.path.includes('/builds/create/notes')) {
      const query: Record<string, string> = {}
      const id = buildStore.editSourceBuildId
      if (id) query.editId = id
      if (route.query.app === 'on') query.app = 'on'
      router.replace(localePath({ path: '/builds/create/champion', query }))
    }
  },
  { immediate: true }
)
</script>
