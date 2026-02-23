<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'skill-order'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div class="mb-6 flex flex-col items-start gap-4 md:flex-row">
        <!-- Step Content (Top on mobile, Left on desktop) -->
        <div class="w-full flex-1 md:order-2">
          <SkillOrderSelector />
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
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import SkillOrderSelector from '~/components/Build/SkillOrderSelector.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'

definePageMeta({
  layout: false,
})

useHead({
  title: 'Créer un build - Ordre des compétences',
  meta: [
    {
      name: 'description',
      content: "Définissez l'ordre de montée des compétences pour votre build",
    },
  ],
})

const buildStore = useBuildStore()
const route = useRoute()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

onMounted(() => {
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }
})

const localePath = useLocalePath()
watch(
  () => buildStore.currentBuild?.champion,
  champion => {
    if (!champion && route.path.includes('/builds/create/skill-order')) {
      navigateTo(localePath('/builds/create/champion'))
    }
  },
  { immediate: true }
)
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
