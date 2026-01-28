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
          <h2 class="mb-6 text-2xl font-bold">Infos</h2>

          <!-- Tabs Navigation -->
          <div class="mb-6 flex gap-2 border-b border-primary/20">
            <button
              type="button"
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                activeTab === 'form'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text/60 hover:text-text'
              "
              @click="activeTab = 'form'"
            >
              Formulaire
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                activeTab === 'skill-order'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text/60 hover:text-text'
              "
              @click="activeTab = 'skill-order'"
            >
              Skill Order
            </button>
          </div>

          <!-- Tab Content: Formulaire -->
          <div v-show="activeTab === 'form'" class="tab-content">
            <div class="space-y-6">
              <div>
                <label for="build-name" class="mb-2 block text-sm font-semibold"
                  >Nom du build</label
                >
                <input
                  id="build-name"
                  v-model="buildName"
                  type="text"
                  placeholder="Entrez le nom du build..."
                  class="w-full max-w-md rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  @input="updateBuildName"
                />
              </div>

              <div>
                <label for="build-author" class="mb-2 block text-sm font-semibold">Auteur</label>
                <input
                  id="build-author"
                  v-model="buildAuthor"
                  type="text"
                  placeholder="Votre pseudo..."
                  class="w-full max-w-md rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  @input="updateBuildAuthor"
                />
              </div>

              <div>
                <label for="build-description" class="mb-2 block text-sm font-semibold">
                  Description
                </label>
                <textarea
                  id="build-description"
                  v-model="buildDescription"
                  rows="5"
                  placeholder="Expliquez le plan de jeu, les forces/faiblesses, matchups, etc."
                  class="w-full max-w-2xl rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-sm text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  @input="updateBuildDescription"
                ></textarea>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold">Visibilité</label>
                <div class="flex items-center gap-4">
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition"
                    :class="
                      visibility === 'public'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-primary/50 bg-surface text-text/70 hover:border-primary'
                    "
                    @click="toggleVisibility"
                  >
                    <span class="text-base">{{ visibility === 'public' ? '🌐' : '🔒' }}</span>
                    <span>{{ visibility === 'public' ? 'Public' : 'Privé' }}</span>
                  </button>
                  <p class="text-xs text-text/60">
                    {{ visibility === 'public' ? 'Visible par tous' : 'Uniquement pour vous' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Save Button (Form Tab) -->
            <div class="mt-8 flex gap-4 border-t border-primary/20 pt-6">
              <button
                :disabled="!buildStore.isBuildValid || buildStore.status === 'loading'"
                :class="[
                  'rounded-lg px-6 py-2.5 font-semibold transition',
                  buildStore.isBuildValid && buildStore.status !== 'loading'
                    ? 'bg-accent text-background hover:bg-accent/90'
                    : 'cursor-not-allowed bg-surface text-text/50',
                ]"
                @click="saveBuild"
              >
                {{ buildStore.status === 'loading' ? 'Sauvegarde...' : 'Sauvegarder le build' }}
              </button>
            </div>
          </div>

          <!-- Tab Content: Skill Order -->
          <div v-show="activeTab === 'skill-order'" class="tab-content">
            <SkillOrderSelector />

            <!-- Save Button (Skill Order Tab) -->
            <div class="mt-8 flex gap-4 border-t border-primary/20 pt-6">
              <button
                :disabled="!buildStore.isBuildValid || buildStore.status === 'loading'"
                :class="[
                  'rounded-lg px-6 py-2.5 font-semibold transition',
                  buildStore.isBuildValid && buildStore.status !== 'loading'
                    ? 'bg-accent text-background hover:bg-accent/90'
                    : 'cursor-not-allowed bg-surface text-text/50',
                ]"
                @click="saveBuild"
              >
                {{ buildStore.status === 'loading' ? 'Sauvegarde...' : 'Sauvegarder le build' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import SkillOrderSelector from '~/components/Build/SkillOrderSelector.vue'
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
const activeTab = ref<'form' | 'skill-order'>('form')
const buildName = ref('New Build')
const buildAuthor = ref('')
const buildDescription = ref('')
const visibility = ref<'public' | 'private'>('public')
const showValidationErrors = ref(false)

const updateBuildName = () => {
  buildStore.setName(buildName.value)
}

const updateBuildAuthor = () => {
  buildStore.setAuthor(buildAuthor.value)
}

const updateBuildDescription = () => {
  buildStore.setDescription(buildDescription.value)
}

const toggleVisibility = () => {
  visibility.value = visibility.value === 'public' ? 'private' : 'public'
  buildStore.setVisibility(visibility.value)
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
  const current = buildStore.currentBuild
  if (current?.name) {
    buildName.value = current.name
  } else {
    buildStore.setName(buildName.value)
  }

  if (current?.author) {
    buildAuthor.value = current.author
  }

  if (current?.description) {
    buildDescription.value = current.description
  }

  if (current?.visibility) {
    visibility.value = current.visibility
  } else {
    visibility.value = 'public'
    buildStore.setVisibility('public')
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

.tab-content {
  min-height: 400px;
}

@media (max-width: 700px) {
  .build-card-wrapper {
    width: 100%;
  }
}
</style>
