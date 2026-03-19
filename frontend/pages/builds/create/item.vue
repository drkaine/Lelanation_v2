<template>
  <div class="build-creator min-h-screen text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'item'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div
        class="build-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isStreamerMode }"
      >
        <!-- Step Content (Top on mobile, Left on desktop) -->
        <div class="w-full flex-1 md:order-2">
          <ItemSelector />
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
import ItemSelector from '~/components/Build/ItemSelector.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import { useStreamerMode } from '~/composables/useStreamerMode'

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
const { isStreamerMode } = useStreamerMode()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

onMounted(() => {
  buildStore.ensureCurrentBuild()
  buildStore.setLastBuilderStep('item')
})
</script>

<style scoped>
.build-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}

.build-layout {
  --build-card-width: 293.9px;
}

.build-layout--streamer {
  --build-card-width: 390px;
}

.build-card-wrapper {
  width: var(--build-card-width);
  margin-top: var(--build-create-card-top-gap, 11px);
}

@media (max-width: 768px) {
  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
