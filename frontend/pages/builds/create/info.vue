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
              v-if="!isStreamerMode"
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

              <!-- Titres des variantes -->
              <div v-if="(buildStore.currentBuild?.subBuilds?.length ?? 0) > 0" class="space-y-3">
                <div>
                  <label class="mb-1 block text-sm font-semibold text-accent">
                    Titre 1 (variante principale)
                  </label>
                  <input
                    v-model="buildName"
                    type="text"
                    placeholder="Ex: Build principal…"
                    class="w-full max-w-md rounded-lg border border-accent/50 bg-surface px-3 py-2 text-sm text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                    @input="updateBuildName"
                  />
                </div>
                <div v-for="(sub, idx) in buildStore.currentBuild?.subBuilds ?? []" :key="idx">
                  <label class="mb-1 block text-sm font-semibold text-accent">
                    Titre {{ idx + 2 }} (variante {{ idx + 2 }})
                  </label>
                  <input
                    :value="sub.title || ''"
                    type="text"
                    placeholder="Ex: Build Assassin, Build Tank…"
                    class="w-full max-w-md rounded-lg border border-accent/50 bg-surface px-3 py-2 text-sm text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                    @input="
                      e => buildStore.setSubBuildTitle(idx, (e.target as HTMLInputElement).value)
                    "
                  />
                </div>
              </div>

              <!-- Sélecteur mode description -->
              <div v-if="(buildStore.currentBuild?.subBuilds?.length ?? 0) > 0">
                <label class="mb-2 block text-sm font-semibold">Mode description</label>
                <div class="flex gap-3">
                  <button
                    type="button"
                    class="rounded-lg border px-4 py-2 text-sm font-medium transition"
                    :class="
                      descriptionMode === 'single'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-primary/50 bg-surface text-text/70 hover:border-primary'
                    "
                    @click="setDescMode('single')"
                  >
                    Une seule description
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border px-4 py-2 text-sm font-medium transition"
                    :class="
                      descriptionMode === 'multiple'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-primary/50 bg-surface text-text/70 hover:border-primary'
                    "
                    @click="setDescMode('multiple')"
                  >
                    Une description par variante
                  </button>
                </div>
              </div>

              <!-- Description(s) -->
              <div
                v-if="
                  descriptionMode === 'single' ||
                  (buildStore.currentBuild?.subBuilds?.length ?? 0) === 0
                "
              >
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

              <!-- Descriptions multiples -->
              <div v-else class="space-y-4">
                <div>
                  <label class="mb-2 block text-sm font-semibold"
                    >Description 1 (variante principale)</label
                  >
                  <textarea
                    v-model="buildDescription"
                    rows="4"
                    :placeholder="t('createBuild.descriptionPlaceholder')"
                    class="w-full max-w-2xl rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-sm text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                    @input="updateBuildDescription"
                  ></textarea>
                </div>
                <div v-for="(sub, idx) in buildStore.currentBuild?.subBuilds ?? []" :key="idx">
                  <label class="mb-2 block text-sm font-semibold">
                    Description {{ idx + 2 }} — {{ sub.title || `Variante ${idx + 2}` }}
                  </label>
                  <textarea
                    :value="sub.description ?? ''"
                    rows="4"
                    :placeholder="`Description pour la variante ${idx + 2}…`"
                    class="w-full max-w-2xl rounded-lg border border-primary/50 bg-surface px-4 py-2.5 text-sm text-text transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50"
                    @input="
                      e =>
                        buildStore.setSubBuildDescription(
                          idx,
                          (e.target as HTMLTextAreaElement).value
                        )
                    "
                  ></textarea>
                </div>
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
                  <div>
                    <span class="font-medium">Skill order:</span>
                    <span
                      :class="
                        validationDebug.checks?.skillOrderComplete ? 'text-success' : 'text-error'
                      "
                    >
                      {{ validationDebug.checks?.skillOrderComplete ? '✓' : '✗' }}
                    </span>
                    <span class="text-text/60"> (first 3 + order) </span>
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
        <div class="build-card-column w-full flex-shrink-0 md:order-1">
          <BuildCard :sheet-tooltips="true" />

          <!-- Zone variantes (sous la card) -->
          <div class="variants-zone">
            <button
              class="variants-trigger"
              :title="
                buildStore.currentBuild?.subBuilds?.length
                  ? 'Gérer les variantes'
                  : 'Créer une variante'
              "
              @click="openVariantsPanel = !openVariantsPanel"
            >
              <span class="variants-count">
                {{ (buildStore.currentBuild?.subBuilds?.length ?? 0) + 1 }}
                variante{{ (buildStore.currentBuild?.subBuilds?.length ?? 0) > 0 ? 's' : '' }}
              </span>
            </button>

            <!-- Panel de gestion des variantes -->
            <div v-if="openVariantsPanel" class="variants-panel">
              <!-- Variante principale -->
              <button
                class="variant-pill"
                :class="{ 'variant-pill--active': buildStore.displayedVariant === 'main' }"
                @click="buildStore.showMainBuild()"
              >
                Variante 1 (principale)
              </button>
              <!-- Variantes existantes -->
              <div
                v-for="(sub, idx) in buildStore.currentBuild?.subBuilds ?? []"
                :key="idx"
                class="variant-pill-row"
              >
                <button
                  class="variant-pill"
                  :class="{ 'variant-pill--active': buildStore.displayedVariant === idx }"
                  @click="buildStore.showSubBuild(idx)"
                >
                  Variante {{ idx + 2 }} — {{ sub.title || '(sans titre)' }}
                </button>
                <button
                  class="variant-remove-btn"
                  title="Supprimer cette variante"
                  @click="buildStore.removeSubBuild(idx)"
                >
                  ✕
                </button>
              </div>
              <!-- Créer une nouvelle variante -->
              <button class="variant-create-btn" @click="buildStore.createSubBuild()">
                + Nouvelle variante
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Popup confirmation changement de champion -->
    <div
      v-if="buildStore.pendingChampionChange"
      class="champion-confirm-overlay"
      @click.self="buildStore.cancelChampionChange()"
    >
      <div class="champion-confirm-modal">
        <p class="champion-confirm-title">Changer de champion ?</p>
        <p class="champion-confirm-body">
          Vous allez perdre toutes les variantes de ce build. Cette action est irréversible.
        </p>
        <div class="champion-confirm-actions">
          <button class="btn-cancel" @click="buildStore.cancelChampionChange()">Annuler</button>
          <button class="btn-confirm" @click="buildStore.confirmChampionChange()">Confirmer</button>
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
import { useStreamerMode } from '~/composables/useStreamerMode'

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
const { isStreamerMode } = useStreamerMode()
const buildName = ref('New Build')
const buildAuthor = ref('')
const buildDescription = ref('')
const visibility = ref<'public' | 'private'>('public')
const showValidationErrors = ref(false)
const openVariantsPanel = ref(false)

// ── Variantes ──────────────────────────────────────────────────────────────
const descriptionMode = computed(() => buildStore.currentBuild?.descriptionMode ?? 'single')

function setDescMode(mode: 'single' | 'multiple') {
  buildStore.setDescriptionMode(mode)
}

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

watch(isStreamerMode, enabled => {
  if (enabled && activeTab.value === 'stats') {
    activeTab.value = 'form'
  }
})
</script>

<style scoped>
.build-card-column {
  width: 293.9px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-content {
  min-height: 400px;
}

/* ── Zone variantes ── */
.variants-zone {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.variants-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--color-gold-300, #c89b3c);
  background: rgba(200, 155, 60, 0.1);
  color: var(--color-gold-300, #c89b3c);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s;
  width: 100%;
  justify-content: center;
}

.variants-trigger:hover {
  background: rgba(200, 155, 60, 0.2);
}

.variants-count {
  font-size: 13px;
}

.variants-panel {
  width: 100%;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(200, 155, 60, 0.3);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.variant-pill-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.variant-pill {
  flex: 1;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(200, 155, 60, 0.3);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.variant-pill:hover {
  border-color: var(--color-gold-300, #c89b3c);
  color: var(--color-gold-300, #c89b3c);
}

.variant-pill--active {
  border-color: var(--color-gold-300, #c89b3c) !important;
  background: rgba(200, 155, 60, 0.15) !important;
  color: var(--color-gold-300, #c89b3c) !important;
}

.variant-remove-btn {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: 1px solid rgba(220, 70, 70, 0.5);
  background: transparent;
  color: rgba(220, 70, 70, 0.7);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.variant-remove-btn:hover {
  background: rgba(220, 70, 70, 0.15);
  color: rgb(220, 70, 70);
}

.variant-create-btn {
  padding: 7px 12px;
  border-radius: 6px;
  border: 1px dashed rgba(200, 155, 60, 0.4);
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.variant-create-btn:hover {
  border-color: var(--color-gold-300, #c89b3c);
  color: var(--color-gold-300, #c89b3c);
}

/* ── Popup confirmation champion ── */
.champion-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.champion-confirm-modal {
  background: rgb(26, 26, 46);
  border: 1px solid var(--color-gold-300, #c89b3c);
  border-radius: 12px;
  padding: 28px 32px;
  max-width: 380px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.champion-confirm-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gold-300, #c89b3c);
  margin: 0;
}

.champion-confirm-body {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
  margin: 0;
}

.champion-confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 9px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.75);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.08);
}

.btn-confirm {
  padding: 9px 20px;
  border-radius: 8px;
  border: none;
  background: rgb(220, 70, 70);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-confirm:hover {
  background: rgb(200, 55, 55);
}

@media (max-width: 768px) {
  .build-card-column {
    width: 100%;
    max-width: 100%;
  }
}
</style>
