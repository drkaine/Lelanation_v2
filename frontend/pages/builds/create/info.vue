<template>
  <div class="build-creator min-h-screen p-4 text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'info'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div class="mb-6 flex flex-col items-start gap-4 md:flex-row">
        <!-- Step Content (Top on mobile, Left on desktop) -->
        <div class="w-full flex-1 md:order-2">
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
              {{ t('createBuild.form') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                activeTab === 'stats'
                  ? 'border-b-2 border-accent text-accent'
                  : 'text-text/60 hover:text-text'
              "
              @click="activeTab = 'stats'"
            >
              {{ t('createBuild.stats') }}
            </button>
          </div>

          <!-- Tab Content: Formulaire -->
          <div v-show="activeTab === 'form'" class="tab-content">
            <div class="space-y-6">
              <div>
                <label for="build-name" class="mb-2 block text-sm font-semibold">
                  {{ t('createBuild.buildName') }}
                </label>
                <input
                  id="build-name"
                  v-model="buildName"
                  type="text"
                  :placeholder="t('createBuild.buildNamePlaceholder')"
                  class="w-full max-w-md rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  @input="updateBuildName"
                />
              </div>

              <div>
                <label for="build-author" class="mb-2 block text-sm font-semibold">{{
                  t('createBuild.author')
                }}</label>
                <input
                  id="build-author"
                  v-model="buildAuthor"
                  type="text"
                  :placeholder="t('createBuild.authorPlaceholder')"
                  class="w-full max-w-md rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  @input="updateBuildAuthor"
                />
              </div>

              <div>
                <label for="build-description" class="mb-2 block text-sm font-semibold">
                  {{ t('createBuild.description') }}
                </label>
                <textarea
                  id="build-description"
                  v-model="buildDescription"
                  rows="5"
                  :placeholder="t('createBuild.descriptionPlaceholder')"
                  class="w-full max-w-2xl rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-sm text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                  @input="updateBuildDescription"
                ></textarea>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-semibold">{{ t('createBuild.visibility') }}</label>
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
                    <span>{{
                      visibility === 'public' ? t('buildsPage.public') : t('buildsPage.private')
                    }}</span>
                  </button>
                  <p class="text-xs text-text/60">
                    {{
                      visibility === 'public'
                        ? t('createBuild.visibleToAll')
                        : t('createBuild.onlyForYou')
                    }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Save Button (Form Tab) -->
            <div class="mt-8 flex flex-col gap-4 border-t border-primary/20 pt-6">
              <!-- Debug Info (développement) -->
              <div
                v-if="!buildStore.isBuildValid && validationDebug.checks"
                class="rounded-lg border border-info/50 bg-info/10 p-4 text-xs"
              >
                <p class="mb-2 font-semibold text-info">{{ t('createBuild.validationState') }}</p>
                <div class="space-y-1 text-text/80">
                  <div>
                    <span class="font-medium">Champion:</span>
                    <span :class="validationDebug.checks?.champion ? 'text-success' : 'text-error'">
                      {{ validationDebug.checks?.champion ? '✓' : '✗' }}
                    </span>
                  </div>
                  <div>
                    <span class="font-medium">Items:</span>
                    <span :class="validationDebug.checks?.items ? 'text-success' : 'text-error'">
                      {{ validationDebug.checks?.items ? '✓' : '✗' }}
                    </span>
                    <span class="text-text/60"> ({{ validationDebug.checks?.itemsCount }})</span>
                  </div>
                  <div>
                    <span class="font-medium">Runes (Primary):</span>
                    <span
                      :class="validationDebug.checks?.runesPrimary ? 'text-success' : 'text-error'"
                    >
                      {{ validationDebug.checks?.runesPrimary ? '✓' : '✗' }}
                    </span>
                  </div>
                  <div>
                    <span class="font-medium">Runes (Secondary):</span>
                    <span
                      :class="
                        validationDebug.checks?.runesSecondary ? 'text-success' : 'text-error'
                      "
                    >
                      {{ validationDebug.checks?.runesSecondary ? '✓' : '✗' }}
                    </span>
                  </div>
                  <div>
                    <span class="font-medium">Summoner Spells:</span>
                    <span
                      :class="
                        validationDebug.checks?.summonerSpells ? 'text-success' : 'text-error'
                      "
                    >
                      {{ validationDebug.checks?.summonerSpells ? '✓' : '✗' }}
                    </span>
                  </div>
                </div>
              </div>
              <!-- Validation Errors Display -->
              <div
                v-if="showValidationErrors && !buildStore.isBuildValid"
                class="rounded-lg border border-warning/50 bg-warning/10 p-4"
              >
                <p class="mb-2 font-semibold text-warning">
                  {{ t('createBuild.buildIncomplete') }}
                </p>
                <ul class="list-inside list-disc space-y-1 text-sm text-text/80">
                  <li v-for="error in buildStore.validationErrors" :key="error">
                    {{ error }}
                  </li>
                </ul>
              </div>
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

          <!-- Tab Content: Statistiques -->
          <div v-show="activeTab === 'stats'" class="tab-content">
            <StatsTable />
          </div>
        </div>

        <!-- Build Card (Bottom on mobile, Right on desktop) -->
        <div class="build-card-wrapper w-full flex-shrink-0 md:order-1">
          <BuildCard />
        </div>
      </div>
    </div>

    <!-- Notification Toast -->
    <NotificationToast
      v-if="showNotification"
      :message="notificationMessage"
      :type="buildStore.status === 'success' ? 'success' : 'error'"
      @close="showNotification = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import StatsTable from '~/components/Build/StatsTable.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
import NotificationToast from '~/components/NotificationToast.vue'

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
const localePath = useLocalePath()
const { t } = useI18n()
const hasChampion = computed(() => Boolean(buildStore.currentBuild?.champion))
const activeTab = ref<'form' | 'stats'>('form')
const buildName = ref('New Build')
const buildAuthor = ref('')
const buildDescription = ref('')
const visibility = ref<'public' | 'private'>('public')
const showValidationErrors = ref(false)

// Debug: computed pour afficher l'état de validation en temps réel
const validationDebug = computed(() => {
  if (!buildStore.currentBuild) {
    return { isValid: false, reason: 'No build' }
  }
  const build = buildStore.currentBuild
  const checks = {
    champion: !!build.champion,
    items: !!(build.items && build.items.length > 0 && build.items.length <= 10),
    itemsCount: build.items?.length || 0,
    runes: !!build.runes,
    runesPrimary: !!(build.runes?.primary?.pathId && build.runes?.primary?.keystone),
    runesSecondary: !!build.runes?.secondary?.pathId,
    summonerSpells: !!(
      build.summonerSpells &&
      build.summonerSpells.length === 2 &&
      build.summonerSpells[0] &&
      build.summonerSpells[1]
    ),
    skillOrder: !!build.skillOrder,
    skillOrderLevels: build.skillOrder
      ? (build.skillOrder.firstThreeUps?.filter(Boolean).length || 0) +
        (build.skillOrder.skillUpOrder?.filter(Boolean).length || 0)
      : 0,
    skillOrderComplete: build.skillOrder
      ? build.skillOrder.firstThreeUps?.length === 3 &&
        build.skillOrder.firstThreeUps.every(v => !!v) &&
        build.skillOrder.skillUpOrder?.length === 3 &&
        build.skillOrder.skillUpOrder.every(v => !!v)
      : false,
  }
  return {
    isValid: buildStore.isBuildValid,
    checks,
    errors: buildStore.validationErrors,
  }
})

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

const showNotification = ref(false)
const notificationMessage = ref('')

const saveBuild = async () => {
  showValidationErrors.value = true
  const success = await buildStore.saveBuild()
  if (success && buildStore.status === 'success') {
    // Afficher la notification verte
    notificationMessage.value = t('createBuild.buildSavedSuccess')
    showNotification.value = true

    // Vider le store pour pouvoir créer un nouveau build de zéro
    buildStore.createNewBuild()

    // Réinitialiser les champs du formulaire
    buildName.value = 'New Build'
    buildAuthor.value = ''
    buildDescription.value = ''
    visibility.value = 'public'
    showValidationErrors.value = false

    setTimeout(() => {
      router.push(localePath('/builds') + '?tab=my-builds')
    }, 1000)
  } else {
    // Afficher une notification d'erreur
    notificationMessage.value = buildStore.error || 'Erreur lors de la sauvegarde'
    showNotification.value = true
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

  // Initialiser les rôles si nécessaire
  if (!current?.roles) {
    buildStore.setRoles([])
  }

  showValidationErrors.value = false
})

watch(
  () => buildStore.currentBuild?.champion,
  champion => {
    if (!champion && route.path.includes('/builds/create/info')) {
      router.replace(localePath('/builds/create/champion'))
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

@media (max-width: 768px) {
  .build-card-wrapper {
    width: 100%;
    max-width: 100%;
  }
}
</style>
