<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'rune'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div class="mb-6 flex flex-col items-start gap-4 md:flex-row">
        <!-- Step Content (Top on mobile, Left on desktop) -->
        <div class="w-full flex-1 md:order-2">
          <div class="runes-step-content">
            <RuneSelector />
          </div>
        </div>

        <!-- Build Card (Bottom on mobile, Right on desktop) -->
        <div class="build-card-wrapper w-full flex-shrink-0 md:order-1">
          <BuildCard :sheet-tooltips="true" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import RuneSelector from '~/components/Build/RuneSelector.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'

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

@media (max-width: 768px) {
  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
