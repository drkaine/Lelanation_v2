<template>
  <div class="build-editor min-h-screen bg-background p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <div v-if="buildStore.status === 'loading'" class="py-12 text-center">
        <p class="text-text">Loading build...</p>
      </div>

      <div v-else-if="buildStore.status === 'error'" class="py-12 text-center">
        <p class="text-error">{{ buildStore.error }}</p>
        <NuxtLink
          to="/builds"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Back to Builds
        </NuxtLink>
      </div>

      <div v-else-if="!buildStore.currentBuild" class="py-12 text-center">
        <p class="text-text">Build not found</p>
        <NuxtLink
          to="/builds"
          class="mt-4 inline-block rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
        >
          Back to Builds
        </NuxtLink>
      </div>

      <div v-else>
        <div class="mb-6 flex items-center justify-between">
          <h1 class="text-3xl font-bold">Edit Build</h1>
          <NuxtLink
            to="/builds"
            class="rounded border border-primary bg-surface px-4 py-2 text-text hover:bg-primary hover:text-white"
          >
            Back to Builds
          </NuxtLink>
        </div>

        <!-- Same structure as create page -->
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

        <!-- Step Navigation -->
        <div class="mb-6 flex flex-wrap gap-2">
          <button
            v-for="step in steps"
            :key="step.id"
            :class="[
              'rounded px-4 py-2 transition-colors',
              currentStep === step.id
                ? 'bg-accent text-background'
                : 'bg-surface text-text hover:bg-primary hover:text-white',
            ]"
            @click="currentStep = step.id"
          >
            {{ step.label }}
          </button>
        </div>

        <!-- Step Content (same as create page) -->
        <div class="mb-6 rounded-lg bg-surface p-6">
          <div v-if="currentStep === 'champion'">
            <h2 class="mb-4 text-2xl font-bold">Select Champion</h2>
            <ChampionSelector />
          </div>
          <div v-if="currentStep === 'items'">
            <h2 class="mb-4 text-2xl font-bold">Select Items</h2>
            <ItemSelector />
          </div>
          <div v-if="currentStep === 'runes'">
            <h2 class="mb-4 text-2xl font-bold">Configure Runes</h2>
            <RuneSelector />
          </div>
          <div v-if="currentStep === 'shards'">
            <h2 class="mb-4 text-2xl font-bold">Select Rune Shards</h2>
            <RuneShardSelector />
          </div>
          <div v-if="currentStep === 'spells'">
            <h2 class="mb-4 text-2xl font-bold">Select Summoner Spells</h2>
            <SummonerSpellSelector />
          </div>
          <div v-if="currentStep === 'skills'">
            <h2 class="mb-4 text-2xl font-bold">Configure Skill Order</h2>
            <SkillOrderSelector />
          </div>
          <div v-if="currentStep === 'review'">
            <h2 class="mb-4 text-2xl font-bold">Review & Statistics</h2>
            <StatsDisplay />
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-4">
          <button
            v-if="currentStepIndex > 0"
            class="rounded border border-primary bg-surface px-6 py-2 text-text hover:bg-primary hover:text-white"
            @click="previousStep"
          >
            Previous
          </button>
          <button
            v-if="currentStepIndex < steps.length - 1"
            class="rounded bg-primary px-6 py-2 text-white hover:bg-primary-dark"
            @click="nextStep"
          >
            Next
          </button>
          <button
            v-if="currentStepIndex === steps.length - 1"
            :disabled="!buildStore.isBuildValid || buildStore.status === 'loading'"
            :class="[
              'rounded px-6 py-2',
              buildStore.isBuildValid && buildStore.status !== 'loading'
                ? 'bg-accent text-background hover:bg-accent-dark'
                : 'text-text/50 cursor-not-allowed bg-surface',
            ]"
            @click="saveBuild"
          >
            {{ buildStore.status === 'loading' ? 'Saving...' : 'Update Build' }}
          </button>
        </div>

        <!-- Validation Errors -->
        <div
          v-if="buildStore.validationErrors.length > 0"
          class="mt-6 rounded border border-error bg-error/20 p-4"
        >
          <p class="mb-2 font-bold text-error">Please fix the following errors:</p>
          <ul class="list-inside list-disc text-error">
            <li v-for="error in buildStore.validationErrors" :key="error">{{ error }}</li>
          </ul>
        </div>

        <!-- Success Message -->
        <div
          v-if="buildStore.status === 'success'"
          class="mt-6 rounded border border-success bg-success/20 p-4"
        >
          <p class="font-bold text-success">Build updated successfully!</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import ItemSelector from '~/components/Build/ItemSelector.vue'
import RuneSelector from '~/components/Build/RuneSelector.vue'
import RuneShardSelector from '~/components/Build/RuneShardSelector.vue'
import SummonerSpellSelector from '~/components/Build/SummonerSpellSelector.vue'
import SkillOrderSelector from '~/components/Build/SkillOrderSelector.vue'
import StatsDisplay from '~/components/Build/StatsDisplay.vue'

const route = useRoute()
const buildStore = useBuildStore()

const steps = [
  { id: 'champion', label: 'Champion' },
  { id: 'items', label: 'Items' },
  { id: 'runes', label: 'Runes' },
  { id: 'shards', label: 'Shards' },
  { id: 'spells', label: 'Spells' },
  { id: 'skills', label: 'Skills' },
  { id: 'review', label: 'Review' },
]

const currentStep = ref('champion')
const buildName = ref('')

const currentStepIndex = computed(() => {
  return steps.findIndex(step => step.id === currentStep.value)
})

const nextStep = () => {
  const index = currentStepIndex.value
  if (index < steps.length - 1) {
    currentStep.value = steps[index + 1].id
  }
}

const previousStep = () => {
  const index = currentStepIndex.value
  if (index > 0) {
    currentStep.value = steps[index - 1].id
  }
}

const updateBuildName = () => {
  buildStore.setName(buildName.value)
}

const saveBuild = async () => {
  const success = await buildStore.saveBuild()
  if (success) {
    setTimeout(() => {
      buildStore.status = 'idle'
    }, 3000)
  }
}

watch(
  () => buildStore.currentBuild?.name,
  name => {
    if (name) {
      buildName.value = name
    }
  },
  { immediate: true }
)

onMounted(() => {
  const buildId = route.params.id as string
  if (buildId) {
    buildStore.loadBuild(buildId)
  }
})
</script>
