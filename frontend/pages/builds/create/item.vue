<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'item'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div class="mb-6 flex items-start gap-4">
        <!-- Build Card (Left Side) - Always visible -->
        <div class="build-card-wrapper flex-shrink-0">
          <BuildCard />
        </div>

        <!-- Step Content (Right Side) -->
        <div class="flex-1">
          <ItemSelector />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import ItemSelector from '~/components/Build/ItemSelector.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'

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
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

onMounted(() => {
  // Only create a new build if one doesn't exist
  // Don't reset an existing build
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }
})
</script>

<style scoped>
.build-card-wrapper {
  width: 293.9px;
}

@media (max-width: 700px) {
  .build-card-wrapper {
    width: 100%;
  }
}
</style>
