<template>
  <div class="build-creator min-h-screen text-text">
    <div class="max-w-8xl mx-auto px-2">
      <!-- Step Navigation -->
      <div class="mb-3">
        <BuildMenuSteps :current-step="'info'" :has-champion="hasChampion" />
      </div>

      <!-- Build Card and Step Content -->
      <div
        class="build-layout mb-3 flex flex-col items-start gap-4 md:flex-row"
        :class="{ 'build-layout--streamer': isStreamerMode }"
      >
        <!-- Step Content (Top on mobile, Left on desktop) -->
        <div class="w-full flex-1 md:order-2">
          <div class="info-toolbar mb-6">
            <div class="info-toolbar-tab">
              {{ t('createBuild.stats') }}
            </div>
            <div
              class="save-button-wrapper"
              @mouseenter="handleSaveButtonHover"
              @mouseleave="showSaveTooltip = false"
            >
              <button
                type="button"
                :aria-disabled="!buildStore.isBuildValid || buildStore.status === 'loading'"
                :class="[
                  'save-button rounded-lg px-6 py-2.5 font-semibold transition',
                  buildStore.isBuildValid && buildStore.status !== 'loading'
                    ? 'bg-accent text-background hover:bg-accent/90'
                    : 'cursor-not-allowed bg-surface text-text/50',
                ]"
                @click="handleSaveButtonClick"
              >
                {{ buildStore.status === 'loading' ? 'Sauvegarde...' : 'Sauvegarder' }}
              </button>
              <div
                v-if="showSaveTooltip && missingValidationMessages.length > 0"
                class="save-tooltip"
              >
                <p class="save-tooltip-title">{{ t('createBuild.buildIncomplete') }}</p>
                <ul class="save-tooltip-list">
                  <li v-for="error in missingValidationMessages" :key="error">
                    {{ error }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="tab-content">
            <div class="border-t border-primary/20 pt-6"></div>
            <StatsTable />
          </div>
        </div>

        <!-- Build Card (Bottom on mobile, Right on desktop) -->
        <div class="build-card-column w-full flex-shrink-0 md:order-1">
          <BuildCard :sheet-tooltips="true" :highlight-missing-fields="highlightMissingFields" />
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
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
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
const { isStreamerMode } = useStreamerMode()
const showSaveTooltip = ref(false)
const highlightMissingFields = ref(false)
let saveHintsTimer: ReturnType<typeof setTimeout> | null = null

const showNotification = ref(false)
const notificationMessage = ref('')

const missingValidationMessages = computed(() => {
  if (buildStore.isBuildValid) return []
  return [...buildStore.validationErrors]
})

const triggerSaveHints = (showTooltip = false) => {
  if (buildStore.isBuildValid || buildStore.status === 'loading') return
  showSaveTooltip.value = showTooltip
  highlightMissingFields.value = true
  if (saveHintsTimer) clearTimeout(saveHintsTimer)
  saveHintsTimer = setTimeout(() => {
    highlightMissingFields.value = false
    showSaveTooltip.value = false
  }, 10000)
}

const handleSaveButtonHover = () => {
  triggerSaveHints(true)
}

const handleSaveButtonClick = () => {
  if (!buildStore.isBuildValid || buildStore.status === 'loading') {
    triggerSaveHints(false)
    return
  }
  saveBuild().catch(() => {})
}

const saveBuild = async () => {
  const success = await buildStore.saveBuild()
  if (success && buildStore.status === 'success') {
    // Afficher la notification verte
    notificationMessage.value = t('createBuild.buildSavedSuccess')
    showNotification.value = true

    // Vider le store pour pouvoir créer un nouveau build de zéro
    buildStore.createNewBuild()

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
  buildStore.ensureCurrentBuild()
  buildStore.setLastBuilderStep('info')

  // Initialiser les rôles si nécessaire
  const current = buildStore.currentBuild
  if (!current?.roles) {
    buildStore.setRoles([])
  }
})

onBeforeUnmount(() => {
  if (saveHintsTimer) clearTimeout(saveHintsTimer)
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

watch(isStreamerMode, () => {
  showSaveTooltip.value = false
})
</script>

<style scoped>
.build-creator {
  padding: var(--build-create-page-padding-top, 1rem) 1rem 1rem;
  margin-top: var(--build-create-page-lift, 0px);
}

.build-layout {
  --build-card-width: 293.9px;
}

.build-layout--streamer {
  --build-card-width: 390px;
}

.build-card-column {
  width: var(--build-card-width);
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: var(--build-create-card-top-gap, 11px);
}

.tab-content {
  min-height: 400px;
}

.info-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.info-toolbar-tab {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 16px;
  border-bottom: 2px solid var(--color-gold-300, #c89b3c);
  color: var(--color-gold-300, #c89b3c);
  font-size: 0.9rem;
  font-weight: 700;
}

.save-button-wrapper {
  position: relative;
}

.save-button {
  min-width: 160px;
}

.save-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: min(320px, 75vw);
  border: 1px solid rgba(220, 38, 38, 0.35);
  border-radius: 10px;
  background: rgba(20, 20, 28, 0.96);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
  padding: 10px 12px;
}

.save-tooltip-title {
  margin: 0 0 6px;
  color: rgb(248, 113, 113);
  font-size: 0.82rem;
  font-weight: 700;
}

.save-tooltip-list {
  margin: 0;
  padding-left: 18px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 0.8rem;
  line-height: 1.45;
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
