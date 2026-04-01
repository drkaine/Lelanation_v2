<template>
  <BuildCreateInfoPageView
    :is-streamer-mode="isLayoutScaled"
    :has-champion="hasChampion"
    :highlight-missing-fields="highlightMissingFields"
    :pending-champion-change="Boolean(buildStore.pendingChampionChange)"
    :stats-category="statsCategory"
    :basic-label="t('stats.categories.basic')"
    :advanced-label="t('stats.categories.advanced')"
    :economic-label="t('stats.categories.economic')"
    :confirm-title="'Changer de champion ?'"
    :confirm-body="'Vous allez perdre toutes les variantes de ce build. Cette action est irréversible.'"
    :cancel-label="'Annuler'"
    :confirm-label="'Confirmer'"
    :build-card-component="BuildCard"
    :build-save-button-component="BuildSaveButton"
    :stats-table-component="StatsTable"
    :build-menu-steps-component="BuildMenuSteps"
    @highlight-missing="highlightMissingFields = $event"
    @update:stats-category="statsCategory = $event"
    @cancel-champion-change="buildStore.cancelChampionChange()"
    @confirm-champion-change="buildStore.confirmChampionChange()"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { BuildCreateInfoPageView } from '@lelanation/builds-ui'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import StatsTable from '~/components/Build/StatsTable.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import { useLayoutScaled } from '~/composables/useLayoutScaled'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Infos',
  meta: [
    {
      name: 'description',
      content: "Finalisez votre build avec le nom, l'ordre des compétences et les statistiques",
    },
  ],
})

const buildStore = useBuildStore()
const router = useRouter()
const route = useRoute()
const localePath = useLocalePath()
const { t } = useI18n()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const { isLayoutScaled } = useLayoutScaled()
const statsCategory = ref<'basic' | 'advanced' | 'economic'>('basic')
const highlightMissingFields = ref(false)

onMounted(() => {
  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  if (editId && buildStore.editSourceBuildId !== editId) {
    const loaded = buildStore.startEditingBuild(editId)
    if (!loaded) buildStore.ensureCurrentBuild()
  } else {
    buildStore.ensureCurrentBuild()
  }
  buildStore.setLastBuilderStep('info')

  // Initialiser les rôles si nécessaire
  const current = buildStore.currentBuild
  if (!current?.roles) {
    buildStore.setRoles([])
  }
})

watch(
  () => buildStore.currentBuild?.champion,
  champion => {
    if (!champion && route.path.includes('/builds/create/info')) {
      const id = buildStore.editSourceBuildId
      const suffix = id ? `?editId=${encodeURIComponent(id)}` : ''
      router.replace(localePath(`/builds/create/champion${suffix}`))
    }
  },
  { immediate: true }
)
</script>
