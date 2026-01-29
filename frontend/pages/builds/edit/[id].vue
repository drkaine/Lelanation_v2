<template>
  <div class="build-editor min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
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

        <OutdatedBuildBanner
          v-if="buildStore.currentBuild?.gameVersion"
          :build-version="buildStore.currentBuild.gameVersion"
          :storage-key="`edit:${buildStore.currentBuild.id}:${buildStore.currentBuild.gameVersion}`"
          :on-update="updateToCurrentVersion"
        />

        <!-- Step Navigation -->
        <div class="mb-4">
          <BuildMenuSteps
            :current-step="currentStep"
            :has-champion="hasChampion"
            @navigate="currentStep = $event"
          />
        </div>

        <!-- Build Card and Step Content -->
        <div class="mb-6 flex flex-col items-start gap-4 md:flex-row">
          <!-- Step Content (Top on mobile, Left on desktop) -->
          <div class="w-full flex-1 md:order-2">
            <div class="rounded-lg bg-surface p-6">
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
              <div v-if="currentStep === 'review'">
                <h2 class="mb-4 text-2xl font-bold">Infos</h2>
                <div class="mb-6">
                  <label for="build-name" class="mb-2 block text-sm font-semibold"
                    >Build Name</label
                  >
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
          </div>

          <!-- Build Card (Bottom on mobile, Right on desktop) -->
          <div class="build-card-wrapper w-full flex-shrink-0 md:order-1">
            <BuildCard />
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
            :disabled="!buildStore.isBuildValid || isSaving"
            :class="[
              'rounded px-6 py-2',
              buildStore.isBuildValid && !isSaving
                ? 'bg-accent text-background hover:bg-accent-dark'
                : 'cursor-not-allowed bg-surface text-text/50',
            ]"
            @click="saveBuild"
          >
            {{ isSaving ? 'Saving...' : 'Update Build' }}
          </button>
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
import SkillOrderSelector from '~/components/Build/SkillOrderSelector.vue'
import StatsDisplay from '~/components/Build/StatsDisplay.vue'
import OutdatedBuildBanner from '~/components/Build/OutdatedBuildBanner.vue'
import { migrateBuildToCurrent } from '~/utils/migrateBuildToCurrent'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import BuildCard from '~/components/Build/BuildCard.vue'

const route = useRoute()
const buildStore = useBuildStore()

const steps = [
  { id: 'champion', label: 'Champion' },
  { id: 'items', label: 'Items' },
  { id: 'runes', label: 'Runes' },
  { id: 'review', label: 'Review' },
]

const currentStep = ref('runes') // Start on runes step when editing
const buildName = ref('')
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const isSaving = computed(() => buildStore.status === 'loading')

const currentStepIndex = computed(() => {
  return steps.findIndex(step => step.id === currentStep.value)
})

const nextStep = () => {
  const index = currentStepIndex.value
  if (index < steps.length - 1) {
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
  const success = await buildStore.saveBuild()
  if (success) {
    setTimeout(() => {
      buildStore.status = 'idle'
    }, 3000)
  }
}

const updateToCurrentVersion = async () => {
  if (!buildStore.currentBuild) return
  const { migrated } = await migrateBuildToCurrent(buildStore.currentBuild)
  const newId = buildStore.importBuild(migrated, { nameSuffix: ' (maj)' })
  if (newId) {
    navigateTo(`/builds/edit/${newId}`)
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

onMounted(async () => {
  const buildId = route.params.id as string
  if (buildId) {
    // Load build from localStorage
    const ok = buildStore.loadBuild(buildId)
    if (ok && buildStore.currentBuild) {
      // Migrate the build to ensure it has the correct structure
      try {
        const { migrated } = await migrateBuildToCurrent(buildStore.currentBuild)
        buildStore.setCurrentBuild(migrated)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Migration failed for edit build:', e)
      }
    }
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
