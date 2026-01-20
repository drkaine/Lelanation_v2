<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="mx-auto max-w-7xl">
      <h1 class="mb-6 text-3xl font-bold">Create Build</h1>

      <!-- Build Name Input -->
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

      <!-- Step Content -->
      <div class="mb-6 rounded-lg bg-surface p-6">
        <!-- Step 1: Champion Selection -->
        <div v-if="currentStep === 'champion'">
          <h2 class="mb-4 text-2xl font-bold">Select Champion</h2>
          <ChampionSelector />
        </div>

        <!-- Step 2: Items -->
        <div v-if="currentStep === 'items'">
          <h2 class="mb-4 text-2xl font-bold">Select Items</h2>
          <ItemSelector />
        </div>

        <!-- Step 3: Runes -->
        <div v-if="currentStep === 'runes'">
          <h2 class="mb-4 text-2xl font-bold">Configure Runes</h2>
          <RuneSelector />
        </div>

        <!-- Step 4: Rune Shards -->
        <div v-if="currentStep === 'shards'">
          <h2 class="mb-4 text-2xl font-bold">Select Rune Shards</h2>
          <RuneShardSelector />
        </div>

        <!-- Step 5: Summoner Spells -->
        <div v-if="currentStep === 'spells'">
          <h2 class="mb-4 text-2xl font-bold">Select Summoner Spells</h2>
          <SummonerSpellSelector />
        </div>

        <!-- Step 6: Skill Order -->
        <div v-if="currentStep === 'skills'">
          <h2 class="mb-4 text-2xl font-bold">Configure Skill Order</h2>
          <SkillOrderSelector />
        </div>

        <!-- Step 7: Review & Stats -->
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
          {{ buildStore.status === 'loading' ? 'Saving...' : 'Save Build' }}
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
        <p class="font-bold text-success">Build saved successfully!</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBuildStore } from '~/stores/BuildStore'
import ChampionSelector from '~/components/Build/ChampionSelector.vue'
import ItemSelector from '~/components/Build/ItemSelector.vue'
import RuneSelector from '~/components/Build/RuneSelector.vue'
import RuneShardSelector from '~/components/Build/RuneShardSelector.vue'
import SummonerSpellSelector from '~/components/Build/SummonerSpellSelector.vue'
import SkillOrderSelector from '~/components/Build/SkillOrderSelector.vue'
import StatsDisplay from '~/components/Build/StatsDisplay.vue'

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
const buildName = ref('New Build')
const showValidationErrors = ref(false)

const currentStepIndex = computed(() => {
  return steps.findIndex(step => step.id === currentStep.value)
})

const nextStep = () => {
  const index = currentStepIndex.value
  if (index >= 0 && index < steps.length - 1) {
    const next = steps[index + 1]
    if (next) currentStep.value = next.id
  }
}

const previousStep = () => {
  const index = currentStepIndex.value
  if (index > 0) {
    const prev = steps[index - 1]
    if (prev) currentStep.value = prev.id
  }
}

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
  buildStore.createNewBuild()
  buildStore.setName(buildName.value)
  showValidationErrors.value = false
})
</script>
