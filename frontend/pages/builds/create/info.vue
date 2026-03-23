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
            <div class="stats-tabs info-toolbar-category-tabs">
              <button
                type="button"
                class="stats-tab"
                :class="{ 'stats-tab--active': statsCategory === 'basic' }"
                @click="statsCategory = 'basic'"
              >
                {{ t('stats.categories.basic') }}
              </button>
              <button
                type="button"
                class="stats-tab"
                :class="{ 'stats-tab--active': statsCategory === 'advanced' }"
                @click="statsCategory = 'advanced'"
              >
                {{ t('stats.categories.advanced') }}
              </button>
              <button
                type="button"
                class="stats-tab"
                :class="{ 'stats-tab--active': statsCategory === 'economic' }"
                @click="statsCategory = 'economic'"
              >
                {{ t('stats.categories.economic') }}
              </button>
            </div>
          </div>

          <div class="tab-content">
            <StatsTable v-model:category="statsCategory" hide-category-tabs />
          </div>
        </div>

        <!-- Build Card (Bottom on mobile, Right on desktop) -->
        <div class="build-card-column w-full flex-shrink-0 md:order-1">
          <BuildSaveButton @highlight-missing="highlightMissingFields = $event" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBuildStore } from '~/stores/BuildStore'
import BuildCard from '~/components/Build/BuildCard.vue'
import BuildSaveButton from '~/components/Build/BuildSaveButton.vue'
import StatsTable from '~/components/Build/StatsTable.vue'
import BuildMenuSteps from '~/components/Build/BuildMenuSteps.vue'
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
const statsCategory = ref<'basic' | 'advanced' | 'economic'>('basic')
const highlightMissingFields = ref(false)

onMounted(() => {
  const editId = typeof route.query.editId === 'string' ? route.query.editId : null
  if (editId && buildStore.editSourceBuildId !== editId) {
    const loaded = buildStore.startEditingBuild(editId)
    if (!loaded) buildStore.ensureCurrentBuild()
  } else {
    buildStore.ensureCurrentBuild()
  }
  buildStore.setLastBuilderStep('info')

  // Initialiser les rôles si nécessaire
  const current = buildStore.currentBuild
  if (!current?.roles) {
    buildStore.setRoles([])
  }
})

watch(
  () => buildStore.currentBuild?.champion,
  champion => {
    if (!champion && route.path.includes('/builds/create/info')) {
      const id = buildStore.editSourceBuildId
      const suffix = id ? `?editId=${encodeURIComponent(id)}` : ''
      router.replace(localePath(`/builds/create/champion${suffix}`))
    }
  },
  { immediate: true }
)
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
  margin-top: 0;
}

.tab-content {
  min-height: 400px;
}

.info-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  column-gap: 12px;
  row-gap: 0;
  flex-wrap: wrap;
}

/* Onglets catégories stats (même style que StatsTable) */
.info-toolbar-category-tabs {
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.info-toolbar-category-tabs.stats-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  min-height: 36px;
  border: 1px solid rgb(var(--rgb-primary) / 0.8);
  border-radius: 0.5rem;
  background: rgb(var(--rgb-background) / 0.25);
  padding: 0.2rem;
}

.info-toolbar-category-tabs .stats-tab {
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: rgb(var(--rgb-text) / 0.75);
  min-height: 30px;
  padding: 0.45rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.1;
  transition: all 0.2s ease;
  cursor: pointer;
}

.info-toolbar-category-tabs .stats-tab:hover {
  background: rgb(var(--rgb-primary) / 0.16);
  color: rgb(var(--rgb-text));
}

.info-toolbar-category-tabs .stats-tab--active {
  background: rgb(var(--rgb-primary) / 0.3);
  color: rgb(var(--rgb-text));
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
