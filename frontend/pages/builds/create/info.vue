<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'info'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div class="mb-6 flex items-start gap-4">
        <!-- Build Card (Left Side) - Always visible -->
        <div class="build-card-wrapper flex-shrink-0">
          <BuildCard />
        </div>

        <!-- Step Content (Right Side) -->
        <div class="flex-1">
          <h2 class="mb-4 text-2xl font-bold">Infos</h2>
          <div class="mb-6">
            <label for="build-name" class="mb-2 block text-sm font-semibold">Build Name</label>
            <input
              id="build-name"
              v-model="buildName"
              type="text"
              placeholder="Enter build name..."
              class="w-full max-w-md rounded border border-primary bg-surface px-4 py-2 text-text"
              @input="updateBuildName"
            />
          </div>
          <div class="mb-8">
            <h3 class="mb-4 text-xl font-bold">Skill Order</h3>
            <SkillOrderSelector />
          </div>
          <StatsDisplay />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-4">
        <button
          :disabled="!buildStore.isBuildValid || buildStore.status === 'loading'"
          :class="[
            'rounded px-6 py-2',
            buildStore.isBuildValid && buildStore.status !== 'loading'
              ? 'bg-accent text-background hover:bg-accent-dark'
              : 'cursor-not-allowed bg-surface text-text/50',
          ]"
          @click="saveBuild"
        >
          {{ buildStore.status === 'loading' ? 'Saving...' : 'Save Build' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import SkillOrderSelector from '~/components/Build/SkillOrderSelector.vue'
import StatsDisplay from '~/components/Build/StatsDisplay.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'

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
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const buildName = ref('New Build')
const showValidationErrors = ref(false)

const updateBuildName = () => {
  buildStore.setName(buildName.value)
}

const saveBuild = async () => {
  showValidationErrors.value = true
  const success = await buildStore.saveBuild()
  if (success) {
    // Reset status after 3 seconds
    setTimeout(() => {
      buildStore.status = 'idle'
    }, 3000)
  }
}

onMounted(() => {
  // Only create a new build if one doesn't exist
  // Don't reset an existing build
  if (!buildStore.currentBuild) {
    buildStore.createNewBuild()
  }

  // Load build name if exists
  if (buildStore.currentBuild?.name) {
    buildName.value = buildStore.currentBuild.name
  } else {
    buildStore.setName(buildName.value)
  }

  showValidationErrors.value = false
})

// Use a watcher to check for champion when navigating to this page
watch(
  () => buildStore.currentBuild?.champion,
  champion => {
    // Only redirect if we're on this page and there's no champion
    if (!champion && route.path === '/builds/create/info') {
      router.replace('/builds/create/champion')
    }
  },
  { immediate: true }
)
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
