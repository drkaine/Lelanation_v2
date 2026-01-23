<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="mx-auto max-w-2xl px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps
          :current-step="currentStep"
          :has-champion="hasChampion"
          @navigate="currentStep = $event"
        />
      </div>

      <!-- Step Content -->
      <div class="mb-6 rounded-lg bg-surface p-6">
        <!-- Step 1: Champion Selection -->
        <div v-if="currentStep === 'champion'">
          <ChampionSelector />
        </div>

        <!-- Step 2: Runes (Runes + Shards + Spells) -->
        <div v-if="currentStep === 'runes'">
          <h2 class="mb-4 text-2xl font-bold">Configure Runes</h2>
          <RuneSelector />

          <div class="mt-8">
            <h3 class="mb-4 text-xl font-bold">Rune Shards</h3>
            <RuneShardSelector />
          </div>

          <div class="mt-8">
            <h3 class="mb-4 text-xl font-bold">Summoner Spells</h3>
            <SummonerSpellSelector />
          </div>
        </div>

        <!-- Step 3: Items -->
        <div v-if="currentStep === 'items'">
          <h2 class="mb-4 text-2xl font-bold">Select Items</h2>
          <ItemSelector />
        </div>

        <!-- Step 4: Info -->
        <div v-if="currentStep === 'review'">
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
              : 'cursor-not-allowed bg-surface text-text/50',
          ]"
          @click="saveBuild"
        >
          {{ buildStore.status === 'loading' ? 'Saving...' : 'Save Build' }}
        </button>
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
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'

const buildStore = useBuildStore()

const steps = [
  { id: 'champion', label: 'Champion' },
  { id: 'runes', label: 'Runes' },
  { id: 'items', label: 'Items' },
  { id: 'review', label: 'Review' },
]

const currentStep = ref('champion')
const buildName = ref('New Build')
const showValidationErrors = ref(false)
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))

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
