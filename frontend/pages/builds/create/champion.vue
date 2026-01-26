<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'champion'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div class="mb-6 flex items-start gap-4">
        <!-- Build Card (Left Side) - Always visible -->
        <div class="build-card-wrapper flex-shrink-0">
          <BuildCard />
        </div>

        <!-- Step Content (Right Side) -->
        <div class="flex-1">
          <ChampionSelector />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'

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
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

// Auto-advance to runes step when champion is selected (only on champion page)
watch(hasChampion, newValue => {
  // Only auto-advance if we're currently on the champion page
  if (newValue && route.path === '/builds/create/champion') {
    router.push('/builds/create/rune')
  }
})

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
