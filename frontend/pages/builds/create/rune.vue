<template>
  <div class="build-creator min-h-screen text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'rune'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div
        class="rune-layout mb-6 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'rune-layout--streamer': isStreamerMode }"
      >
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
const { isStreamerMode } = useStreamerMode()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

onMounted(() => {
  buildStore.ensureCurrentBuild()
  buildStore.setLastBuilderStep('rune')
})
</script>

<style scoped>
.build-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}

.rune-layout {
  --rune-card-width: 300px;
  --rune-card-height: 450px;
  /* Taille agrandie pour runes, sorts d'invocateur et shards (comme en streamer) */
  --rune-selector-scale: 1.3;
}

.rune-layout--streamer {
  --rune-card-width: 390px;
  --rune-card-height: 585px;
  --rune-selector-scale: 1.3;
}

.build-card-wrapper {
  width: var(--rune-card-width);
  margin-top: var(--build-create-card-top-gap, 11px);
}

@media (min-width: 768px) {
  .rune-layout {
    align-items: stretch;
  }

  .runes-step-content {
    min-height: var(--rune-card-height);
    --selector-path-size: calc(44px * var(--rune-selector-scale));
    --selector-rune-size: calc(48px * var(--rune-selector-scale));
    --selector-square-size: calc(48px * var(--rune-selector-scale));
    --selector-gap-size: calc(0.25rem * var(--rune-selector-scale));
  }

  .runes-step-content :deep(.runesPage),
  .runes-step-content :deep(.wrap),
  .runes-step-content :deep(.paths-container) {
    height: 100%;
  }
}

@media (max-width: 768px) {
  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
